# The Shared Sanctum

**A real-time collaborative whiteboard for teams to think, create, and collaborate together.**

The Shared Sanctum is a collaborative whiteboard application where multiple users can work on a shared canvas in real time. It provides interactive drawing tools, sticky notes, text objects, room-based collaboration, and revision history to help teams brainstorm and organize ideas together.

## ✨ Features

### 🎨 Interactive Whiteboard
- Create and edit sticky notes and text objects.
- Draw freely using the pen tool and erase strokes.
- Drag and reposition canvas objects.
- Pan and zoom across the canvas.
- Grid snapping for precise object placement.
- Minimap for navigating the canvas.
- Export the whiteboard as a PNG image.

### 🤝 Real-Time Collaboration
- User authentication with signup and login.
- Create rooms and join using invitation codes.
- Real-time synchronization using Socket.IO.
- Live collaborator cursors with distinct colors.
- Room-isolated collaboration so updates stay within the correct room.

### 🕘 Revision History
- Persistent revision timeline for boards.
- Track changes through revision snapshots.
- Branch-aware revision history.
- Compare revisions using a read-only Diff view.
- Identify added, deleted, and modified objects.
- Restore previous revisions without deleting existing history.
- Synchronize restored boards with room collaborators.

### ↩️ Undo and Redo
- Undo and redo supported board operations using the existing history system.

## 🛠️ Tech Stack

**Frontend**
- React
- Vite
- React Router
- Tailwind CSS
- CSS

**Backend**
- Node.js
- Express.js
- Socket.IO

**Database and Authentication**
- MongoDB
- Mongoose
- JSON Web Tokens (JWT)
- bcryptjs

## 📁 Project Structure

```text
the-shared-sanctum/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx
│       │   ├── Header.jsx
│       │   ├── Toolbar.jsx
│       │   ├── StickyNote.jsx
│       │   ├── TextItem.jsx
│       │   ├── DrawingLayer.jsx
│       │   ├── SelectionOverlay.jsx
│       │   └── RevisionTimeline.jsx
│       ├── hooks/
│       ├── revisions/
│       │   ├── revisionHistory.js
│       │   └── revisionDiff.js
│       ├── App.jsx
│       ├── App.css
│       └── socket.js
│
└── server/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    └── server.js
```

*The structure above highlights the main application files; other files may exist in the repository.*

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Node.js and npm
- MongoDB running locally or an accessible MongoDB database
- Git

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd the-shared-sanctum
```

Replace the repository URL with your actual GitHub repository URL.

### 2. Configure the backend

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory and configure the environment variables expected by your backend.

Example:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_random_secret
```

Use the exact variable names expected by your current server code. Configure any additional required variables, such as frontend origins, if your application uses them.

### 3. Start the backend

```bash
npm start
```

If the project does not define a `start` script, use the development command configured in `server/package.json`, or run the server entry point directly.

### 4. Configure and start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

Ensure the frontend API and Socket.IO URLs point to the running backend. Update development URLs and environment variables according to the configuration used in your project.

## 🔄 How It Works

1. **Authenticate:** Create an account or log in.
2. **Create a room:** Start a collaborative whiteboard.
3. **Invite collaborators:** Share the room invitation code.
4. **Collaborate:** Add notes, text, and drawings while other users see updates in real time.
5. **Review changes:** Open History to browse saved revisions.
6. **Compare revisions:** Inspect differences between two snapshots.
7. **Restore a revision:** Restore an earlier board state while preserving the existing revision history.

## 🔐 Security Considerations

- Keep JWT secrets and database credentials in environment variables.
- Never commit `.env` files or other secrets to GitHub.
- Validate authentication and room membership on protected backend operations.
- Keep Socket.IO events scoped to the appropriate room.
- Use HTTPS and secure production configuration when deploying.

## 🧪 Testing

Before deployment, verify:

- Signup and login.
- Room creation and invitation-based joining.
- Real-time synchronization between multiple users.
- Isolation between different rooms.
- Drawing, sticky notes, text, panning, zoom, and minimap.
- Undo and redo.
- Revision persistence after refreshing.
- Revision comparison and restoration.
- Shared-room updates after restoring a revision.
- Error handling when the network or backend is unavailable.

## 🗺️ Future Improvements

Potential improvements include:

- Production deployment and environment configuration.
- Automated end-to-end tests.
- Improved offline and reconnection handling.
- Additional collaboration and board-management capabilities.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request describing the changes.

## 📄 License

Add a license before distributing or reusing this project. Until a license is specified, no additional reuse permissions are granted by this README.

---

**The Shared Sanctum — Think together. Build together.**
