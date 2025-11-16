import Component from "./Component.mjs";
import API from "./API.mjs";

export default class ChannelProperties extends Component {
    constructor(props) {
        super(props);
        this.channel = props.channel || null;
        this.isNewChannel = !this.channel;
    }

    async render(element) {
        await super.render(element);

        // Add overlay class to the component's root element
        this.element.classList.add('channel-properties-overlay');

        const title = this.isNewChannel ? 'Create Channel' : 'Channel Properties';
        const name = this.channel?.name || '';
        const description = this.channel?.description || '';
        const type = this.channel?.type || 'channel';
        const isDM = type === 'dm';

        this.element.innerHTML = `
            <div class="channel-properties-dialog-wrapper">
                <div class="channel-properties-dialog">
                    <div class="channel-properties-header">
                        <h2>${title}</h2>
                        <button id="close-btn" class="icon-button" title="Close">
                            <span class="icon icon-x"></span>
                        </button>
                    </div>
                    <div class="channel-properties-body">
                        ${isDM ? `
                            <div class="form-info">
                                Direct messages cannot be edited.
                            </div>
                            <div class="form-group">
                                <label>Participants</label>
                                <div class="dm-participants">
                                    ${(this.channel?.dmParticipants || []).join(', ')}
                                </div>
                            </div>
                        ` : `
                            <div class="form-group">
                                <label for="channel-name">Channel Name *</label>
                                <input
                                    type="text"
                                    id="channel-name"
                                    class="form-input"
                                    placeholder="Enter channel name"
                                    value="${name}"
                                    ${!this.isNewChannel ? '' : 'autofocus'}
                                    required
                                />
                            </div>
                            <div class="form-group">
                                <label for="channel-description">Description</label>
                                <textarea
                                    id="channel-description"
                                    class="form-input"
                                    placeholder="Optional description"
                                    rows="3"
                                >${description}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Channel Type</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="channel-type"
                                            value="channel"
                                            ${type === 'channel' ? 'checked' : ''}
                                        />
                                        <span class="icon icon-hash"></span>
                                        <span>Private Channel</span>
                                        <span class="radio-description">Only invited members can see and access</span>
                                    </label>
                                    <label class="radio-label">
                                        <input
                                            type="radio"
                                            name="channel-type"
                                            value="public"
                                            ${type === 'public' ? 'checked' : ''}
                                        />
                                        <span class="icon icon-globe"></span>
                                        <span>Public Channel</span>
                                        <span class="radio-description">Anyone in the account can see and join</span>
                                    </label>
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="channel-properties-footer">
                        <button id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        ${isDM ? '' : `
                            <button id="save-btn" class="btn btn-primary">
                                ${this.isNewChannel ? 'Create' : 'Save'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Setup event listeners
        this.element.querySelector('#close-btn').addEventListener('click', () => this.close());
        this.element.querySelector('#cancel-btn').addEventListener('click', () => this.close());

        // Click overlay background to close
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });

        if (!isDM) {
            this.element.querySelector('#save-btn').addEventListener('click', () => this.save());

            // Allow Enter key to submit when in name field
            this.element.querySelector('#channel-name').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.save();
                }
            });
        }

        // Focus the name input if new channel
        if (this.isNewChannel && !isDM) {
            this.element.querySelector('#channel-name')?.focus();
        }
    }

    async save() {
        const nameInput = this.element.querySelector('#channel-name');
        const descriptionInput = this.element.querySelector('#channel-description');
        const typeInput = this.element.querySelector('input[name="channel-type"]:checked');

        const name = nameInput?.value?.trim();
        if (!name) {
            window.toast?.error('Channel name is required');
            nameInput?.focus();
            return;
        }

        const data = {
            name,
            description: descriptionInput?.value?.trim() || '',
            type: typeInput?.value || 'channel'
        };

        try {
            let channel;
            if (this.isNewChannel) {
                channel = await API.post('/chat/channel', data);
                window.toast?.success('Channel created');
            } else {
                channel = await API.put(`/chat/channel/${this.channel._id}`, data);
                window.toast?.success('Channel updated');
            }

            this.fire('saved', channel);
            this.close();
        } catch (e) {
            console.error('Error saving channel:', e);
            window.toast?.error('Failed to save channel');
        }
    }

    close() {
        this.fire('close');
        this.element.remove();
    }
}