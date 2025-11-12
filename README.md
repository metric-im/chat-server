# Chat Server

A Slack-like chat module for metric-im with channels and direct messages.

## Features

- **Channels**: Create public or private channels for team communication
- **Direct Messages**: One-on-one private conversations
- **Real-time Updates**: Messages are polled every 2 seconds for new content
- **Message Management**: Edit and delete your own messages
- **Member Management**: Add and remove members from channels
- **Authentication**: Integrated with epistery for user identity and authentication

## Installation

```bash
cd ~/workspace/metric-im/chat-server
npm install
```

## Usage

### Server-side Integration

```javascript
import ChatServer from '@metric-im/chat-server';

// In your componentry initialization
await componentry.init(
    // ... other modules
    ChatServer
);
```

### Client-side Usage

```javascript
import Chat from '/components/Chat.mjs';

// Render the chat interface
const chat = new Chat({
    context: {
        userId: 'user-id',
        id: 'account-id'
    }
});
await chat.render(document.body);
```

## API Endpoints

### Channels

- `GET /chat/channels` - Get all channels the user has access to
- `POST /chat/channel` - Create a new channel
  - Body: `{ name, description, type }`
- `GET /chat/channel/:channelId` - Get channel details and members
- `POST /chat/channel/:channelId/member` - Add a member to a channel
  - Body: `{ userId }`
- `DELETE /chat/channel/:channelId/member/:userId` - Remove a member from a channel

### Direct Messages

- `GET /chat/dms` - Get all DM conversations
- `POST /chat/dm` - Create or get existing DM with a user
  - Body: `{ targetUserId }`

### Messages

- `GET /chat/messages/:channelId` - Get messages from a channel
  - Query params: `limit` (default: 50), `before` (timestamp)
- `POST /chat/message` - Send a message
  - Body: `{ channelId, text }`
- `PUT /chat/message/:messageId` - Edit a message
  - Body: `{ text }`
- `DELETE /chat/message/:messageId` - Delete a message

## Data Structures

### Channel
```javascript
{
    _id: String,
    name: String,
    description: String,
    type: 'channel' | 'public' | 'private' | 'dm',
    dmParticipants: [String], // Only for DMs
    accountId: String,
    createdBy: String,
    createdAt: Date,
    modifiedAt: Date
}
```

### Message
```javascript
{
    _id: String,
    channelId: String,
    userId: String,
    text: String,
    createdAt: Date,
    modifiedAt: Date,
    edited: Boolean
}
```

### Member
```javascript
{
    _id: String,
    channelId: String,
    userId: String,
    joinedAt: Date
}
```

## Components

### Chat
Main component that renders the entire chat interface with sidebar and chat window.

### ChatSidebar
Left sidebar showing channels and DMs list.

### ChatWindow
Main chat area showing messages and input field.

## Authentication

The module uses epistery for authentication. All endpoints require an authenticated user with `req.account.id` and `req.account.userId`.

The authentication middleware is applied to all `/chat/*` routes:
```javascript
router.use('/chat', (req, res, next) => {
    if (req.account && req.account.id) next();
    else res.status(401).send();
});
```

## Database Collections

The module uses three MongoDB collections:

- `chat_channels` - Stores channel information
- `chat_messages` - Stores all messages
- `chat_members` - Stores channel membership

Indexes are automatically created on initialization for optimal query performance.

## Styling

The module includes a CSS file at `assets/chat.css` that provides a complete styling solution. The styles use CSS variables for theming:

- `--background-secondary`
- `--border-color`
- `--hover-background`
- `--active-background`
- `--text-muted`
- `--primary-color`
- `--primary-hover`
- `--spacer`
- `--spacerhalf`

## Development

Based on the wiki-mixin structural template, the chat-server follows the same patterns:

- Server module extends `Componentry.Module`
- Client components extend `Component`
- Uses epistery for authentication
- Follows the componentry framework conventions

## Future Enhancements

Potential improvements for future versions:

- WebSocket support for true real-time messaging
- File uploads and image sharing
- Message reactions and threading
- User presence indicators
- Typing indicators
- Search functionality
- Message pinning
- Notifications
- Rich text formatting
