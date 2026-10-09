import React, { useState } from 'react';
import { useAppContext, Transaction } from '../context/AppContext';
import { Plus, Minus, Mic, FileText, Search, Trash2, Edit, X, CheckCircle2, ArrowUpDown, Calendar } from 'lucide-react';
import { AudioSpeakerButton } from '../components/AudioSpeakerButton';

export default function Transactions() {
  const { transactions, deleteTransaction, addTransaction, loc, language } = useAppContext();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Entry Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState<'sale' | 'expense'>('sale');
  const [newCategory, setNewCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editItem, setEditItem] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<'sale' | 'expense'>('sale');

  // Search and filter
  const filteredTx = transactions.filter((t: Transaction) => {
    const matchesFilter = filter === 'all' || t.type === filter;
    const matchesSearch = !searchQuery.trim() || 
      (t.item && t.item.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.date && t.date.includes(searchQuery)) ||
      (t.amount && t.amount.toString().includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  const handleDelete = (id: number | string) => {
    if (window.confirm(loc.deleteConfirm || "Delete this transaction?")) {
      deleteTransaction(id);
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingTxn(t);
    setEditItem(t.item || '');
    setEditAmount(t.amount.toString());
    setEditDate(t.date || new Date().toISOString().split('T')[0]);
    setEditType(t.type);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0 || !editItem.trim()) return;

    // Delete existing and re-add updated
    await deleteTransaction(editingTxn.id);
    await addTransaction({
      type: editType,
      item: editItem.trim(),
      category: editingTxn.category || (editType === 'sale' ? 'Sales' : 'Expenses'),
      quantity: editingTxn.quantity,
      unit_price: editingTxn.quantity ? Math.round((amt / editingTxn.quantity) * 100) / 100 : undefined,
      amount: amt,
      date: editDate,
      source: editingTxn.source || 'manual'
    });

    setEditingTxn(null);
  };

  const handleAddNewEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!amt || amt <= 0 || !newItem.trim()) return;

    setIsSubmitting(true);
    try {
      await addTransaction({
        type: newType,
        item: newItem.trim(),
        category: newCategory.trim() || (newType === 'sale' ? 'Sales' : 'Expenses'),
        amount: amt,
        date: newDate || new Date().toISOString().split('T')[0],
        source: 'manual'
      });
      setShowAddModal(false);
      setNewItem('');
      setNewAmount('');
      setNewCategory('');
      setNewDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Totals for filtered view
  const totalFilteredIncome = filteredTx.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const totalFilteredExpense = filteredTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">{loc.ledgerTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{loc.ledgerSubtitle}</p>
        </div>

        {/* Search, Filter & Add Entry Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setNewDate(new Date().toISOString().split('T')[0]);
              setShowAddModal(true);
            }}
            className="bg-brand-900 hover:bg-brand-800 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus size={15} />
            <span>{loc.addEntryBtn || "+ Add Entry (Any Date)"}</span>
          </button>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder={loc.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold outline-none focus:border-brand-500 w-44 sm:w-56 shadow-2xs"
            />
          </div>

          <select 
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none font-bold text-xs text-gray-700 shadow-2xs focus:border-brand-500 cursor-pointer"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{loc.allEntries}</option>
            <option value="sale">{loc.salesOnly}</option>
            <option value="expense">{loc.expensesOnly}</option>
          </select>
        </div>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs text-xs font-bold">
        <div className="text-center sm:text-left sm:pl-3">
          <span className="text-gray-400 uppercase text-[10px] block">{loc.allEntries}</span>
          <span className="text-brand-900 text-base">{filteredTx.length} records</span>
        </div>
        <div className="text-center sm:text-left sm:pl-3 border-x border-gray-100">
          <span className="text-gray-400 uppercase text-[10px] block">{loc.incomeLabel}</span>
          <span className="text-green-600 text-base">₹{totalFilteredIncome.toLocaleString('en-IN')}</span>
        </div>
        <div className="text-center sm:text-left sm:pl-3">
          <span className="text-gray-400 uppercase text-[10px] block">{loc.expenseLabel}</span>
          <span className="text-rose-500 text-base">₹{totalFilteredExpense.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Ledger Records Table / Cards */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredTx.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium text-sm">
            {loc.noEntriesFound}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTx.map((t: Transaction) => (
              <div 
                key={t.id} 
                className="p-4 md:p-5 flex flex-col md:flex-row md:justify-between md:items-center hover:bg-surface-50/70 transition group gap-4"
              >
                {/* Left: Icon, Description, Date & Source */}
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    t.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {t.type === 'sale' ? <Plus size={20} /> : <Minus size={20} />}
                  </div>

                  <div>
                    <p className="font-bold text-brand-900 text-base">
                      {t.quantity && t.quantity > 1 ? `${t.quantity} × ` : ''}{t.item || t.category}
                    </p>

                    <div className="flex flex-wrap items-center mt-0.5 text-xs text-gray-500 gap-1.5 font-medium">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span className="text-gray-400">{t.category || (t.type === 'sale' ? 'Sales' : 'Expenses')}</span>
                      <span>•</span>
                      <span className="flex items-center text-accent-600 font-semibold">
                        {t.source === 'voice' ? (
                          <><Mic size={12} className="mr-1" /> {loc.sourceVoice}</>
                        ) : t.source === 'demo' ? (
                          <><CheckCircle2 size={12} className="mr-1" /> {loc.sourceDemo}</>
                        ) : (
                          <><FileText size={12} className="mr-1" /> {loc.sourceManual}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-5 pl-15 md:pl-0">
                  <span className={`font-black text-xl ${
                    t.type === 'sale' ? 'text-green-600' : 'text-rose-600'
                  }`}>
                    {t.type === 'sale' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                  </span>

                  <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {/* Speak Transaction Audio Button */}
                    <AudioSpeakerButton
                      text={
                        language === 'mr'
                          ? `${t.date} रोजीचा ${t.type === 'sale' ? 'विक्री उत्पन्न' : 'खर्च'} ₹${t.amount}, ${t.item || t.category}.`
                          : language === 'hi'
                          ? `${t.date} को ${t.type === 'sale' ? 'बिक्री आय' : 'खर्च'} ₹${t.amount}, ${t.item || t.category}।`
                          : `${t.type === 'sale' ? 'Sale income' : 'Expense'} of ₹${t.amount} for ${t.item || t.category} on ${t.date}.`
                      }
                      size="sm"
                      title={language === 'mr' ? 'नोंद ऐका' : language === 'hi' ? 'लेन-देन सुनें' : 'Listen to Transaction'}
                    />

                    <button 
                      onClick={() => startEdit(t)}
                      className="p-2 text-gray-400 hover:text-brand-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer" 
                      title={loc.edit}
                    >
                      <Edit size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id)} 
                      className="p-2 text-gray-400 hover:text-rose-600 bg-gray-100 hover:bg-rose-50 rounded-xl transition cursor-pointer" 
                      title={loc.delete}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setEditingTxn(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-xl text-brand-900 mb-1">
              {loc.editEntry}
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Update details for this transaction
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setEditType('sale')}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    editType === 'sale' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  + {loc.incomeLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('expense')}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    editType === 'expense' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  - {loc.expenseLabel}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Item / Description</label>
                <input
                  type="text"
                  required
                  value={editItem}
                  onChange={(e) => setEditItem(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-semibold outline-none focus:bg-white focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-medium outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTxn(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 transition text-sm cursor-pointer"
                >
                  {loc.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-900 hover:bg-brand-800 text-white font-extrabold transition shadow-md text-sm cursor-pointer"
                >
                  ✓ {loc.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Entry Modal (Supports any past date) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-extrabold text-brand-900">
                  {loc.addEntryModalTitle || "Add Transaction (Past or Present Date)"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {loc.entryDateHelp || "Pick today or any previous date"}
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddNewEntry} className="space-y-4">
              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{loc.entryType || "Type"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('sale')}
                    className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                      newType === 'sale'
                        ? 'bg-green-600 text-white border-green-600 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Plus size={14} />
                    {loc.entryIncome || "Income (+)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('expense')}
                    className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                      newType === 'expense'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Minus size={14} />
                    {loc.entryExpense || "Expense (-)"}
                  </button>
                </div>
              </div>

              {/* Date with Past Date Support */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3">
                <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                  <Calendar size={14} className="text-amber-700" />
                  {loc.entryDate} <span className="text-[11px] font-normal text-amber-800">{language === 'mr' ? '(मागील तारीखही निवडू शकता)' : language === 'hi' ? '(पिछली तारीख भी चुन सकते हैं)' : '(Past dates allowed)'}</span>
                </label>
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-bold text-brand-900 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                />
              </div>

              {/* Item / Service */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  {loc.entryItem || "Item / Service / Reason"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newType === 'sale' 
                    ? (language === 'mr' ? 'उदा. २० डबे विक्री' : language === 'hi' ? 'उदा. 20 टिफिन बिक्री' : 'e.g. Sold 20 tiffins') 
                    : (language === 'mr' ? 'उदा. भाजीपाला खरेदी' : language === 'hi' ? 'उदा. सब्जी खरीदारी' : 'e.g. Bought vegetables')}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-semibold outline-none focus:bg-white focus:border-brand-500"
                />
              </div>

              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    {loc.entryAmount || "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="₹"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-black outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    {loc.entryCategory || "Category"}
                  </label>
                  <input
                    type="text"
                    placeholder={newType === 'sale' ? 'Sales' : 'Raw Material'}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-medium outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 transition text-sm cursor-pointer"
                >
                  {loc.cancel || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-brand-900 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold transition shadow-md text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? "..." : `✓ ${loc.saveEntryBtn || "Save Entry"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
