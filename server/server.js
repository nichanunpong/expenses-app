require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); // Middleware: allow JSON in requests

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: 'date must be YYYY-MM-DD',
      },
    },
    category: {
      type: String,
      required: true,
      enum: [
        'food',
        'transport',
        'rent',
        'utilities',
        'shopping',
        'entertainment',
        'health',
        'income',
        'other',
      ],
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'amount must be >=0'],
      set: (v) => Math.round(Number(v) * 100) / 100, // keep 2 decimals
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true, strict: true }
);

const Expense = mongoose.model('Expense', expenseSchema);

// READ: all expenses
app.get('/expenses', async (req, res, next) => {
  try {
    const items = await Expense.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// CREATE: a new expense
app.post('/expenses', async (req, res, next) => {
  try {
    const { date, category, amount, notes } = req.body;

    // tiny validation
    if (!date || !category || amount == null) {
      return res
        .status(400)
        .json({ error: 'date, category, anme amounth are required' });
    }
    const expense = await Expense.create({
      date,
      category,
      amount: Number(amount),
      notes: notes || '',
    });

    res.status(201).location(`/expenses/${expense._id}`).json(expense);
  } catch (err) {
    next(err);
  }
});

// READ: one expense
app.get('/expenses/:id', async (req, res, next) => {
  const { id } = req.params;
  console.log(req.params);
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ error: 'invalid id format' });
  try {
    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ error: 'expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// UPDATE: partial update by id
app.patch('/expenses/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ error: 'invalid id format' });

  const allowed = ['date', 'category', 'amonut', 'notes'];
  const update = {};
  for (const k of allowed) {
    if (req.body[k] != undefined) update[k] = req.body[k];
  }
  if (!Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }
  try {
    const updated = await Expense.findByIdAndUpdate(id, update, {
      new: true, // return updated doc
      runValidators: true, // run schema validators on update
    });
    if (!updated) return res.status(400).json({ error: 'expense not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE: remove an expense by id
app.delete('/expenses/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ error: 'invalid id format' });

  try {
    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'expense not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.get('/__error', (req, res) => {
  const e = new Error('Boom (test error)');
  e.status = 418;
  throw e;
});

// Centralizaed error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      details: err.details || undefined,
    },
  });
});

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
