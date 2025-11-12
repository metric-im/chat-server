import Component from "./Component.mjs";
import ChatSidebar from "./ChatSidebar.mjs";
import ChatWindow from "./ChatWindow.mjs";

export default class Chat extends Component {
    constructor(props) {
        super(props);
        this.currentChannelId = null;
        this.currentChannelType = null; // 'channel' or 'dm'
    }

    async render(element) {
        await super.render(element);

        this.element.innerHTML = `
            <div class="chat-container">
                <div id="chat-sidebar" class="chat-sidebar"></div>
                <div id="chat-window" class="chat-window"></div>
            </div>
        `;

        // Render sidebar
        this.sidebar = this.new(ChatSidebar, {
            context: this.props.context
        });
        await this.sidebar.render(this.element.querySelector('#chat-sidebar'));

        // Listen for channel selection
        this.sidebar.on('selectChannel', this.selectChannel.bind(this));
        this.sidebar.on('selectDM', this.selectDM.bind(this));

        // Render empty state for chat window
        this.chatWindow = this.new(ChatWindow, {
            context: this.props.context
        });
        await this.chatWindow.render(this.element.querySelector('#chat-window'));
    }

    async selectChannel(channelId) {
        this.currentChannelId = channelId;
        this.currentChannelType = 'channel';
        await this.chatWindow.loadChannel(channelId);
    }

    async selectDM(dmId) {
        this.currentChannelId = dmId;
        this.currentChannelType = 'dm';
        await this.chatWindow.loadChannel(dmId);
    }
}
