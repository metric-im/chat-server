import express from 'express';
import Componentry from "@metric-im/componentry";
import moment from "moment";

export default class ChatServer extends Componentry.Module {
    constructor(connector) {
        super(connector, import.meta.url);
        this.connector = connector;
        this.channelsCollection = this.connector.db.collection('chat_channels');
        this.messagesCollection = this.connector.db.collection('chat_messages');
        this.membersCollection = this.connector.db.collection('chat_members');
    }

    static async mint(connector) {
        let instance = new ChatServer(connector);
        await instance.initialize();
        return instance;
    }

    async initialize() {
        // Create indexes for efficient queries
        await this.channelsCollection.createIndex({ "type": 1, "accountId": 1 });
        await this.channelsCollection.createIndex({ "name": 1 });
        await this.messagesCollection.createIndex({ "channelId": 1, "createdAt": -1 });
        await this.messagesCollection.createIndex({ "dmParticipants": 1 });
        await this.membersCollection.createIndex({ "channelId": 1, "userId": 1 }, { unique: true });
    }

    routes() {
        const router = express.Router();

        // Auth middleware for all chat routes
        router.use('/chat', (req, res, next) => {
            if (req.account && req.account.id) next();
            else res.status(401).send();
        });

        // Channel routes
        router.get("/chat/channels", async (req, res) => {
            try {
                const channels = await this.getChannels(req.account);
                res.json(channels);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.post("/chat/channel", async (req, res) => {
            try {
                const channel = await this.createChannel(req.account, req.body);
                res.json(channel);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.get("/chat/channel/:channelId", async (req, res) => {
            try {
                const channel = await this.getChannel(req.account, req.params.channelId);
                res.json(channel);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        // Direct message routes
        router.get("/chat/dms", async (req, res) => {
            try {
                const dms = await this.getDirectMessages(req.account);
                res.json(dms);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.post("/chat/dm", async (req, res) => {
            try {
                const dm = await this.createOrGetDM(req.account, req.body.targetUserId);
                res.json(dm);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        // Message routes
        router.get("/chat/messages/:channelId", async (req, res) => {
            try {
                const messages = await this.getMessages(req.account, req.params.channelId, {
                    limit: parseInt(req.query.limit) || 50,
                    before: req.query.before
                });
                res.json(messages);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.post("/chat/message", async (req, res) => {
            try {
                const message = await this.sendMessage(req.account, req.body);
                res.json(message);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.put("/chat/message/:messageId", async (req, res) => {
            try {
                const message = await this.updateMessage(req.account, req.params.messageId, req.body);
                res.json(message);
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.delete("/chat/message/:messageId", async (req, res) => {
            try {
                await this.deleteMessage(req.account, req.params.messageId);
                res.json({ success: true });
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        // Member management
        router.post("/chat/channel/:channelId/member", async (req, res) => {
            try {
                await this.addMember(req.account, req.params.channelId, req.body.userId);
                res.json({ success: true });
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        router.delete("/chat/channel/:channelId/member/:userId", async (req, res) => {
            try {
                await this.removeMember(req.account, req.params.channelId, req.params.userId);
                res.json({ success: true });
            } catch (e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });

        return router;
    }

    // Channel operations
    async getChannels(account) {
        // Get all channels the user is a member of
        const memberships = await this.membersCollection.find({ userId: account.userId }).toArray();
        const channelIds = memberships.map(m => m.channelId);

        const channels = await this.channelsCollection.find({
            $or: [
                { _id: { $in: channelIds } },
                { type: 'public', accountId: account.id }
            ]
        }).sort({ name: 1 }).toArray();

        return channels;
    }

    async createChannel(account, data) {
        const writeAccess = await this.connector.acl.test.write({ user: account.userId }, { account: account.id });
        if (!writeAccess) throw new Error('unauthorized');

        const channel = {
            _id: Componentry.IdForge.datedId(),
            name: data.name,
            description: data.description || '',
            type: data.type || 'channel', // 'channel' or 'public' or 'private'
            accountId: account.id,
            createdBy: account.userId,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        await this.channelsCollection.insertOne(channel);

        // Add creator as first member
        await this.addMember(account, channel._id, account.userId);

        return channel;
    }

    async getChannel(account, channelId) {
        const channel = await this.channelsCollection.findOne({ _id: channelId });
        if (!channel) throw new Error('Channel not found');

        // Check if user has access
        const isMember = await this.membersCollection.findOne({ channelId, userId: account.userId });
        if (!isMember && channel.type !== 'public') {
            throw new Error('unauthorized');
        }

        // Get member list
        const members = await this.membersCollection.find({ channelId }).toArray();
        channel.members = members;

        return channel;
    }

    // Direct message operations
    async getDirectMessages(account) {
        // Find all DM channels where the user is a participant
        const dms = await this.channelsCollection.find({
            type: 'dm',
            dmParticipants: account.userId
        }).sort({ modifiedAt: -1 }).toArray();

        return dms;
    }

    async createOrGetDM(account, targetUserId) {
        // Check if DM already exists between these users
        const participants = [account.userId, targetUserId].sort();

        let dm = await this.channelsCollection.findOne({
            type: 'dm',
            dmParticipants: { $all: participants, $size: 2 }
        });

        if (dm) return dm;

        // Create new DM
        dm = {
            _id: Componentry.IdForge.datedId(),
            name: `DM: ${participants.join(', ')}`,
            type: 'dm',
            dmParticipants: participants,
            accountId: account.id,
            createdBy: account.userId,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        await this.channelsCollection.insertOne(dm);

        // Add both users as members
        await this.addMember(account, dm._id, account.userId);
        await this.addMember(account, dm._id, targetUserId);

        return dm;
    }

    // Message operations
    async getMessages(account, channelId, options = {}) {
        const channel = await this.channelsCollection.findOne({ _id: channelId });
        if (!channel) throw new Error('Channel not found');

        // Check access
        const isMember = await this.membersCollection.findOne({ channelId, userId: account.userId });
        if (!isMember && channel.type !== 'public') {
            throw new Error('unauthorized');
        }

        const query = { channelId };
        if (options.before) {
            query.createdAt = { $lt: new Date(options.before) };
        }

        const messages = await this.messagesCollection
            .find(query)
            .sort({ createdAt: -1 })
            .limit(options.limit || 50)
            .toArray();

        return messages.reverse();
    }

    async sendMessage(account, data) {
        const channel = await this.channelsCollection.findOne({ _id: data.channelId });
        if (!channel) throw new Error('Channel not found');

        // Check if user is a member
        const isMember = await this.membersCollection.findOne({
            channelId: data.channelId,
            userId: account.userId
        });
        if (!isMember && channel.type !== 'public') {
            throw new Error('unauthorized');
        }

        const message = {
            _id: Componentry.IdForge.datedId(),
            channelId: data.channelId,
            userId: account.userId,
            text: data.text,
            createdAt: new Date(),
            modifiedAt: new Date(),
            edited: false
        };

        await this.messagesCollection.insertOne(message);

        // Update channel's last activity
        await this.channelsCollection.updateOne(
            { _id: data.channelId },
            { $set: { modifiedAt: new Date() } }
        );

        return message;
    }

    async updateMessage(account, messageId, data) {
        const message = await this.messagesCollection.findOne({ _id: messageId });
        if (!message) throw new Error('Message not found');
        if (message.userId !== account.userId) throw new Error('unauthorized');

        await this.messagesCollection.updateOne(
            { _id: messageId },
            {
                $set: {
                    text: data.text,
                    modifiedAt: new Date(),
                    edited: true
                }
            }
        );

        return await this.messagesCollection.findOne({ _id: messageId });
    }

    async deleteMessage(account, messageId) {
        const message = await this.messagesCollection.findOne({ _id: messageId });
        if (!message) throw new Error('Message not found');
        if (message.userId !== account.userId) throw new Error('unauthorized');

        await this.messagesCollection.deleteOne({ _id: messageId });
    }

    // Member management
    async addMember(account, channelId, userId) {
        const channel = await this.channelsCollection.findOne({ _id: channelId });
        if (!channel) throw new Error('Channel not found');

        // Only channel creator or existing members can add new members
        const isCreator = channel.createdBy === account.userId;
        const isMember = await this.membersCollection.findOne({
            channelId,
            userId: account.userId
        });

        if (!isCreator && !isMember) throw new Error('unauthorized');

        try {
            await this.membersCollection.insertOne({
                _id: Componentry.IdForge.datedId(),
                channelId,
                userId,
                joinedAt: new Date()
            });
        } catch (e) {
            // Ignore duplicate key errors (user already a member)
            if (e.code !== 11000) throw e;
        }
    }

    async removeMember(account, channelId, userId) {
        const channel = await this.channelsCollection.findOne({ _id: channelId });
        if (!channel) throw new Error('Channel not found');

        // Users can remove themselves, or channel creator can remove others
        const isCreator = channel.createdBy === account.userId;
        const isSelf = userId === account.userId;

        if (!isCreator && !isSelf) throw new Error('unauthorized');

        await this.membersCollection.deleteOne({ channelId, userId });
    }

    get library() {
        return {
            'moment': '/moment/min/moment-with-locales.min.js'
        };
    }
}
