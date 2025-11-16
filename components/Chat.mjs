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

        this.sidebar = await this.draw(ChatSidebar, {context: this.props.context},this.element);
        this.chatWindow = await this.draw(ChatWindow, {context: this.props.context},this.element);

        // Listen for channel selection
        this.sidebar.on('selectChannel', this.selectChannel.bind(this));
        this.sidebar.on('selectDM', this.selectDM.bind(this));
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
