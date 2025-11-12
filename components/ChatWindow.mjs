import Component from "./Component.mjs";
import API from "./API.mjs";

export default class ChatWindow extends Component {
    constructor(props) {
        super(props);
        this.channel = null;
        this.messages = [];
        this.pollInterval = null;
    }

    async render(element) {
        await super.render(element);

        this.element.innerHTML = `
            <div class="chat-window-empty">
                <div class="empty-message">
                    <span class="icon icon-message"></span>
                    <p>Select a channel or DM to start chatting</p>
                </div>
            </div>
        `;
    }

    async loadChannel(channelId) {
        // Stop polling previous channel
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        try {
            this.channel = await API.get(`/chat/channel/${channelId}`);
            this.messages = await API.get(`/chat/messages/${channelId}`);

            this.renderChannel();

            // Start polling for new messages every 2 seconds
            this.pollInterval = setInterval(() => {
                this.pollMessages();
            }, 2000);

        } catch (e) {
            console.error('Error loading channel:', e);
            window.toast?.error('Failed to load channel');
        }
    }

    async pollMessages() {
        if (!this.channel) return;

        try {
            const latestMessage = this.messages[this.messages.length - 1];
            const newMessages = await API.get(`/chat/messages/${this.channel._id}`, {
                after: latestMessage?.createdAt
            });

            if (newMessages.length > 0) {
                this.messages.push(...newMessages);
                this.renderMessages();
                this.scrollToBottom();
            }
        } catch (e) {
            console.error('Error polling messages:', e);
        }
    }

    renderChannel() {
        const icon = this.channel.type === 'dm' ? 'user' :
                     this.channel.type === 'public' ? 'globe' : 'hash';

        this.element.innerHTML = `
            <div class="chat-header">
                <div class="channel-info">
                    <span class="icon icon-${icon}"></span>
                    <h2>${this.channel.name}</h2>
                </div>
                <div class="channel-actions">
                    <button id="channel-settings-btn" class="icon-button" title="Channel Settings">
                        <span class="icon icon-cog"></span>
                    </button>
                </div>
            </div>
            <div id="messages-container" class="messages-container"></div>
            <div class="message-input-container">
                <textarea id="message-input"
                          placeholder="Type a message..."
                          rows="1"></textarea>
                <button id="send-btn" class="send-button">
                    <span class="icon icon-paper-plane"></span>
                </button>
            </div>
        `;

        // Setup event listeners
        const sendBtn = this.element.querySelector('#send-btn');
        const messageInput = this.element.querySelector('#message-input');

        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        });

        this.renderMessages();
        this.scrollToBottom();
    }

    renderMessages() {
        const container = this.element.querySelector('#messages-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-messages">
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        let lastDate = null;
        let lastUserId = null;

        this.messages.forEach((message, index) => {
            const messageDate = new Date(message.createdAt);
            const dateStr = messageDate.toLocaleDateString();

            // Add date divider if day changed
            if (dateStr !== lastDate) {
                const dateDivider = document.createElement('div');
                dateDivider.className = 'date-divider';
                dateDivider.innerHTML = `<span>${dateStr}</span>`;
                container.appendChild(dateDivider);
                lastDate = dateStr;
            }

            // Group messages from same user
            const isGrouped = message.userId === lastUserId;
            lastUserId = message.userId;

            const messageEl = document.createElement('div');
            messageEl.className = `message ${isGrouped ? 'grouped' : ''}`;
            messageEl.dataset.messageId = message._id;

            const isOwn = message.userId === this.props.context.userId;

            let html = '';
            if (!isGrouped) {
                html += `
                    <div class="message-header">
                        <span class="message-user">${message.userId}</span>
                        <span class="message-time">${this.formatTime(messageDate)}</span>
                    </div>
                `;
            }

            html += `
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                    ${isOwn ? `
                        <div class="message-actions">
                            <button class="icon-button-tiny edit-btn" title="Edit">
                                <span class="icon icon-pencil"></span>
                            </button>
                            <button class="icon-button-tiny delete-btn" title="Delete">
                                <span class="icon icon-trash"></span>
                            </button>
                        </div>
                    ` : ''}
                </div>
                ${message.edited ? '<span class="edited-indicator">(edited)</span>' : ''}
            `;

            messageEl.innerHTML = html;

            // Add event listeners for own messages
            if (isOwn) {
                const editBtn = messageEl.querySelector('.edit-btn');
                const deleteBtn = messageEl.querySelector('.delete-btn');

                if (editBtn) {
                    editBtn.addEventListener('click', () => this.editMessage(message));
                }
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => this.deleteMessage(message._id));
                }
            }

            container.appendChild(messageEl);
        });
    }

    async sendMessage() {
        const input = this.element.querySelector('#message-input');
        const text = input.value.trim();

        if (!text || !this.channel) return;

        try {
            const message = await API.post('/chat/message', {
                channelId: this.channel._id,
                text: text
            });

            this.messages.push(message);
            this.renderMessages();
            this.scrollToBottom();

            input.value = '';
            input.style.height = 'auto';

        } catch (e) {
            console.error('Error sending message:', e);
            window.toast?.error('Failed to send message');
        }
    }

    async editMessage(message) {
        const newText = await window.popup.prompt('Edit message:', message.text);
        if (!newText || newText === message.text) return;

        try {
            const updated = await API.put(`/chat/message/${message._id}`, {
                text: newText
            });

            // Update message in local array
            const index = this.messages.findIndex(m => m._id === message._id);
            if (index !== -1) {
                this.messages[index] = updated;
                this.renderMessages();
            }

            window.toast?.success('Message updated');
        } catch (e) {
            console.error('Error editing message:', e);
            window.toast?.error('Failed to edit message');
        }
    }

    async deleteMessage(messageId) {
        const confirmed = await window.popup.confirm(
            'Delete this message?',
            'This action cannot be undone'
        );
        if (!confirmed) return;

        try {
            await API.delete(`/chat/message/${messageId}`);

            // Remove message from local array
            this.messages = this.messages.filter(m => m._id !== messageId);
            this.renderMessages();

            window.toast?.success('Message deleted');
        } catch (e) {
            console.error('Error deleting message:', e);
            window.toast?.error('Failed to delete message');
        }
    }

    scrollToBottom() {
        const container = this.element.querySelector('#messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
