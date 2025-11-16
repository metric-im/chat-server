import Component from "./Component.mjs";
import API from "./API.mjs";
import ChannelProperties from "./ChannelProperties.mjs";

export default class ChatSidebar extends Component {
    constructor(props) {
        super(props);
        this.channels = [];
        this.dms = [];
    }

    async render(element) {
        await super.render(element);

        this.element.innerHTML = `
            <div class="sidebar-header">
                <h2>Chat</h2>
            </div>
            <div class="sidebar-section">
                <div class="section-header">
                    <span class="icon icon-chevron-right toggle-icon"></span>
                    <h3>Channels</h3>
                    <button id="new-channel-btn" class="icon-button-small" title="New Channel">
                        <span class="icon icon-plus"></span>
                    </button>
                </div>
                <div id="channels-list" class="channel-list"></div>
            </div>
            <div class="sidebar-section">
                <div class="section-header">
                    <span class="icon icon-chevron-right toggle-icon"></span>
                    <h3>Direct Messages</h3>
                    <button id="new-dm-btn" class="icon-button-small" title="New DM">
                        <span class="icon icon-plus"></span>
                    </button>
                </div>
                <div id="dms-list" class="channel-list"></div>
            </div>
        `;

        // Setup event listeners
        this.element.querySelector('#new-channel-btn').addEventListener('click',
            this.createChannel.bind(this));
        this.element.querySelector('#new-dm-btn').addEventListener('click',
            this.createDM.bind(this));

        // Setup section toggles
        const sectionHeaders = this.element.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const section = header.parentElement;
                const list = section.querySelector('.channel-list');
                const icon = header.querySelector('.toggle-icon');
                list.classList.toggle('collapsed');
                icon.classList.toggle('collapsed');
            });
        });

        await this.loadChannels();
        await this.loadDMs();
    }

    async loadChannels() {
        try {
            this.channels = await API.get('/chat/channels');
            this.renderChannels();
        } catch (e) {
            console.error('Error loading channels:', e);
            window.toast?.error('Failed to load channels');
        }
    }

    async loadDMs() {
        try {
            this.dms = await API.get('/chat/dms');
            this.renderDMs();
        } catch (e) {
            console.error('Error loading DMs:', e);
            window.toast?.error('Failed to load DMs');
        }
    }

    renderChannels() {
        const channelsList = this.element.querySelector('#channels-list');
        channelsList.innerHTML = '';

        if (this.channels.length === 0) {
            channelsList.innerHTML = '<div class="empty-state">No channels yet</div>';
            return;
        }

        this.channels.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.dataset.channelId = channel._id;

            const icon = channel.type === 'public' ? 'globe' : 'hash';
            item.innerHTML = `
                <span class="icon icon-${icon}"></span>
                <span class="channel-name">${channel.name}</span>
            `;

            item.addEventListener('click', () => {
                this.selectChannel(channel._id);
            });

            channelsList.appendChild(item);
        });
    }

    renderDMs() {
        const dmsList = this.element.querySelector('#dms-list');
        dmsList.innerHTML = '';

        if (this.dms.length === 0) {
            dmsList.innerHTML = '<div class="empty-state">No DMs yet</div>';
            return;
        }

        this.dms.forEach(dm => {
            const item = document.createElement('div');
            item.className = 'channel-item dm-item';
            item.dataset.channelId = dm._id;

            // Get the other participant's name
            const otherUser = dm.dmParticipants.find(
                p => p !== this.props.context.userId
            ) || 'Unknown';

            item.innerHTML = `
                <span class="icon icon-user"></span>
                <span class="channel-name">${otherUser}</span>
            `;

            item.addEventListener('click', () => {
                this.selectDM(dm._id);
            });

            dmsList.appendChild(item);
        });
    }

    selectChannel(channelId) {
        // Remove active class from all items
        this.element.querySelectorAll('.channel-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected item
        const selectedItem = this.element.querySelector(
            `.channel-item[data-channel-id="${channelId}"]`
        );
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        this.fire('selectChannel', channelId);
    }

    selectDM(dmId) {
        // Remove active class from all items
        this.element.querySelectorAll('.channel-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected item
        const selectedItem = this.element.querySelector(
            `.channel-item[data-channel-id="${dmId}"]`
        );
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        this.fire('selectDM', dmId);
    }

    async createChannel() {
        const propertiesDialog = this.new(ChannelProperties, {
            channel: null // null means creating new channel
        });

        await propertiesDialog.render(document.body);

        propertiesDialog.on('saved', async (channel) => {
            this.channels.push(channel);
            this.renderChannels();
            this.selectChannel(channel._id);
        });

        propertiesDialog.on('close', () => {
            propertiesDialog.element.remove();
        });
    }

    async createDM() {
        const userId = await window.popup.prompt('Enter user ID for direct message:');
        if (!userId) return;

        try {
            const dm = await API.post('/chat/dm', { targetUserId: userId });
            this.dms.push(dm);
            this.renderDMs();
            this.selectDM(dm._id);
            window.toast?.success('DM created');
        } catch (e) {
            console.error('Error creating DM:', e);
            window.toast?.error('Failed to create DM');
        }
    }
}
