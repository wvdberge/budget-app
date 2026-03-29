const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve React build in production
const clientDist = path.join(__dirname, 'public');
app.use(express.static(clientDist));

// Routes
app.use('/api/profiles',     require('./routes/profiles'));
app.use('/api/accounts',     require('./routes/accounts'));
app.use('/api/groups',       require('./routes/groups'));
app.use('/api/categories',   require('./routes/categories'));
app.use('/api/budget',       require('./routes/budget'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/import',       require('./routes/import'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Budget server running on port ${PORT}`));
