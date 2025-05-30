import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory user database
// Admin can add/remove users dynamically
const users = {
  admin: { password: 'adminpass', role: 'admin' }
};

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true,
}));

// Middleware to require login for protected routes
function requireLogin(req, res, next) {
  if (!req.session.username) {
    return res.redirect('/');
  }
  next();
}

// Middleware to require admin role
function requireAdmin(req, res, next) {
  if (!req.session.username || users[req.session.username]?.role !== 'admin') {
    return res.status(403).send('Access denied. Admins only.');
  }
  next();
}

// Login page
app.get('/', (req, res) => {
  if (req.session.username) {
    res.send(`
      <h2>Welcome, ${req.session.username} (${users[req.session.username].role})</h2>
      <p><a href="/proxy">Use Proxy</a></p>
      ${users[req.session.username].role === 'admin' ? '<p><a href="/admin">Admin Panel</a></p>' : ''}
      <p><a href="/logout">Logout</a></p>
    `);
  } else {
    res.send(`
      <form method="POST" action="/login">
        Username: <input name="username" required /><br/>
        Password: <input type="password" name="password" required /><br/>
        <button type="submit">Login</button>
      </form>
    `);
  }
});

// Login handler
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username].password === password) {
    req.session.username = username;
    res.redirect('/');
  } else {
    res.send('Invalid username or password. <a href="/">Try again</a>');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Proxy usage page (form to enter any URL)
app.get('/proxy', requireLogin, (req, res) => {
  res.send(`
    <h3>Proxy for ${req.session.username}</h3>
    <form method="GET" action="/fetch">
      Enter URL:<br/>
      <input name="url" style="width: 400px" required /><br/>
      <button type="submit">Go</button>
    </form>
    <p><a href="/">Back</a></p>
  `);
});

// Proxy fetch - fetches and returns the requested URL
app.get('/fetch', requireLogin, async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.send('Please provide a URL.');
  }

  try {
    const response = await fetch(targetUrl);

    // Copy content-type header
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    const body = await response.text();

    // Optionally: You can modify links inside the HTML here to route through proxy again

    res.send(body);
  } catch (err) {
    res.send('Failed to fetch the requested URL.');
  }
});

// Admin panel: manage users
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  let userListHtml = Object.entries(users).map(([username, info]) =>
    `<li>${username} (${info.role}) 
      ${username !== 'admin' ? `<a href="/admin/delete-user?username=${username}" onclick="return confirm('Delete user?')">Delete</a>` : ''}
    </li>`
  ).join('');

  res.send(`
    <h2>Admin Panel</h2>
    <h3>Users:</h3>
    <ul>${userListHtml}</ul>

    <h3>Add User</h3>
    <form method="POST" action="/admin/add-user">
      Username: <input name="username" required /><br/>
      Password: <input name="password" required /><br/>
      Role:
      <select name="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select><br/>
      <button type="submit">Add User</button>
    </form>

    <p><a href="/">Back to Home</a></p>
  `);
});

// Add user handler
app.post('/admin/add-user', requireLogin, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (users[username]) {
    return res.send('User already exists. <a href="/admin">Back</a>');
  }
  users[username] = { password, role: role === 'admin' ? 'admin' : 'user' };
  res.redirect('/admin');
});

// Delete user handler
app.get('/admin/delete-user', requireLogin, requireAdmin, (req, res) => {
  const { username } = req.query;
  if (username === 'admin') {
    return res.send('Cannot delete the main admin user. <a href="/admin">Back</a>');
  }
  delete users[username];
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
