import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { 
  Users, DollarSign, Phone, CheckCircle, XCircle, LogOut, 
  Plus, Trash2, Edit, UserX, UserCheck, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { useAuth } from '../api/AuthContext';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [countries, setCountries] = useState([]);
  const [virtualNumbers, setVirtualNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Add Number Dialog
  const [addNumberOpen, setAddNumberOpen] = useState(false);
  const [newNumber, setNewNumber] = useState({ phone_number: '', country_code: '' });
  
  // Edit Pricing Dialog
  const [editPricingOpen, setEditPricingOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadUsers(),
      loadPendingTransactions(),
      loadPricing(),
      loadCountries(),
      loadVirtualNumbers()
    ]);
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const loadPendingTransactions = async () => {
    try {
      const response = await api.get('/admin/transactions/pending');
      setPendingTransactions(response.data);
    } catch (error) {
      toast.error('Failed to load pending transactions');
    }
  };

  const loadPricing = async () => {
    try {
      const response = await api.get('/pricing');
      setPricing(response.data);
    } catch (error) {
      toast.error('Failed to load pricing');
    }
  };

  const loadCountries = async () => {
    try {
      const response = await api.get('/countries');
      setCountries(response.data);
    } catch (error) {
      toast.error('Failed to load countries');
    }
  };

  const loadVirtualNumbers = async () => {
    try {
      const response = await api.get('/admin/numbers');
      setVirtualNumbers(response.data);
    } catch (error) {
      toast.error('Failed to load virtual numbers');
    }
  };

  const handleApproveTransaction = async (transactionId) => {
    setLoading(true);
    try {
      await api.post(`/admin/transactions/${transactionId}/approve`);
      toast.success('Transaction approved');
      loadPendingTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTransaction = async (transactionId) => {
    setLoading(true);
    try {
      await api.post(`/admin/transactions/${transactionId}/reject`);
      toast.success('Transaction rejected');
      loadPendingTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    setLoading(true);
    try {
      const response = await api.put(`/admin/users/${userId}/toggle-status`);
      toast.success(response.data.message);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNumber = async () => {
    if (!newNumber.phone_number || !newNumber.country_code) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const numberData = {
        id: crypto.randomUUID(),
        country_code: newNumber.country_code,
        phone_number: newNumber.phone_number,
        status: 'available',
        user_id: null,
        assigned_at: null,
        next_billing_date: null
      };
      
      await api.post('/admin/numbers', numberData);
      toast.success('Number added successfully');
      setAddNumberOpen(false);
      setNewNumber({ phone_number: '', country_code: '' });
      loadVirtualNumbers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add number');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNumber = async (numberId) => {
    if (!window.confirm('Are you sure you want to delete this number?')) return;
    
    setLoading(true);
    try {
      await api.delete(`/admin/numbers/${numberId}`);
      toast.success('Number deleted');
      loadVirtualNumbers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete number');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPricing = (pricingItem) => {
    setEditingPricing({ ...pricingItem });
    setEditPricingOpen(true);
  };

  const handleUpdatePricing = async () => {
    if (!editingPricing) return;
    
    setLoading(true);
    try {
      await api.put(`/admin/pricing/${editingPricing.id}`, editingPricing);
      toast.success('Pricing updated successfully');
      setEditPricingOpen(false);
      setEditingPricing(null);
      loadPricing();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getCountryName = (code) => {
    const country = countries.find(c => c.code === code);
    return country ? `${country.flag} ${country.name}` : code;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 md:p-6" data-testid="admin-dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-primary">Admin Panel</h1>
            <span className="text-sm text-gray-500">Dial Pro Management</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            data-testid="admin-logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold" data-testid="total-users">{users.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending Approvals</p>
                  <p className="text-2xl font-bold" data-testid="pending-transactions">{pendingTransactions.length}</p>
                </div>
                <DollarSign className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Virtual Numbers</p>
                  <p className="text-2xl font-bold" data-testid="total-numbers">{virtualNumbers.length}</p>
                </div>
                <Phone className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Countries</p>
                  <p className="text-2xl font-bold" data-testid="total-countries">{countries.length}</p>
                </div>
                <Globe className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="numbers" data-testid="tab-numbers">Numbers</TabsTrigger>
            <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
          </TabsList>

          {/* Pending Transactions */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Pending USDT Top-ups</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTransactions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending transactions</p>
                ) : (
                  <div className="space-y-4">
                    {pendingTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="border rounded-lg p-4"
                        data-testid={`pending-tx-${tx.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">Amount: ${tx.amount.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Method: {tx.method?.toUpperCase()}</p>
                            <p className="text-sm text-gray-600">User ID: {tx.user_id}</p>
                            <p className="text-sm text-gray-600">
                              Date: {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                            Pending
                          </span>
                        </div>
                        {tx.txid && (
                          <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                            <p className="text-xs font-medium mb-1">Transaction ID:</p>
                            <p className="text-xs font-mono break-all">{tx.txid}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveTransaction(tx.id)}
                            disabled={loading}
                            className="flex-1"
                            data-testid={`approve-tx-${tx.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectTransaction(tx.id)}
                            disabled={loading}
                            className="flex-1"
                            data-testid={`reject-tx-${tx.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-right p-2">Balance</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b" data-testid={`user-row-${user.id}`}>
                          <td className="p-2">{user.name}</td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2 font-mono text-sm">{user.phone_number}</td>
                          <td className="p-2 text-right font-mono">${user.wallet_balance?.toFixed(2) || '0.00'}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                user.disabled
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {user.disabled ? 'Disabled' : 'Active'}
                            </span>
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                user.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {user.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant={user.disabled ? "default" : "destructive"}
                                onClick={() => handleToggleUserStatus(user.id)}
                                disabled={loading}
                                data-testid={`toggle-user-${user.id}`}
                              >
                                {user.disabled ? (
                                  <>
                                    <UserCheck className="w-4 h-4 mr-1" />
                                    Enable
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-4 h-4 mr-1" />
                                    Disable
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Virtual Numbers */}
          <TabsContent value="numbers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Virtual Numbers Management</CardTitle>
                <Dialog open={addNumberOpen} onOpenChange={setAddNumberOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-number-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Number
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Virtual Number</DialogTitle>
                      <DialogDescription>
                        Add a new virtual number to the system
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Country</Label>
                        <Select 
                          value={newNumber.country_code} 
                          onValueChange={(value) => setNewNumber({...newNumber, country_code: value})}
                        >
                          <SelectTrigger data-testid="new-number-country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country.id} value={country.code}>
                                {country.flag} {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Phone Number</Label>
                        <Input
                          placeholder="+1234567890"
                          value={newNumber.phone_number}
                          onChange={(e) => setNewNumber({...newNumber, phone_number: e.target.value})}
                          data-testid="new-number-input"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddNumberOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddNumber} disabled={loading} data-testid="confirm-add-number">
                        Add Number
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Phone Number</th>
                        <th className="text-left p-2">Country</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Assigned To</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {virtualNumbers.map((number) => (
                        <tr key={number.id} className="border-b" data-testid={`number-row-${number.id}`}>
                          <td className="p-2 font-mono">{number.phone_number}</td>
                          <td className="p-2">{getCountryName(number.country_code)}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                number.status === 'available'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {number.status}
                            </span>
                          </td>
                          <td className="p-2 text-sm text-gray-600">
                            {number.user_id || '-'}
                          </td>
                          <td className="p-2 text-center">
                            {number.status === 'available' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteNumber(number.id)}
                                disabled={loading}
                                data-testid={`delete-number-${number.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {virtualNumbers.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No virtual numbers added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Country Pricing Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pricing.map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-lg p-4"
                      data-testid={`pricing-${p.country_code}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{getCountryName(p.country_code)}</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditPricing(p)}
                          data-testid={`edit-pricing-${p.country_code}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Number/month</p>
                          <p className="font-bold">${p.number_price_monthly}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Call/min</p>
                          <p className="font-bold">${p.call_price_per_minute}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">SMS</p>
                          <p className="font-bold">${p.sms_price}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Unlimited Plan</p>
                          <p className="font-bold">${p.unlimited_call_plan_monthly}/mo</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Edit Pricing Dialog */}
            <Dialog open={editPricingOpen} onOpenChange={setEditPricingOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Pricing - {editingPricing?.country_code}</DialogTitle>
                  <DialogDescription>
                    Update pricing for this country
                  </DialogDescription>
                </DialogHeader>
                {editingPricing && (
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Number Price (Monthly)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPricing.number_price_monthly}
                        onChange={(e) => setEditingPricing({
                          ...editingPricing, 
                          number_price_monthly: parseFloat(e.target.value)
                        })}
                        data-testid="edit-number-price"
                      />
                    </div>
                    <div>
                      <Label>Call Price (Per Minute)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={editingPricing.call_price_per_minute}
                        onChange={(e) => setEditingPricing({
                          ...editingPricing, 
                          call_price_per_minute: parseFloat(e.target.value)
                        })}
                        data-testid="edit-call-price"
                      />
                    </div>
                    <div>
                      <Label>SMS Price</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={editingPricing.sms_price}
                        onChange={(e) => setEditingPricing({
                          ...editingPricing, 
                          sms_price: parseFloat(e.target.value)
                        })}
                        data-testid="edit-sms-price"
                      />
                    </div>
                    <div>
                      <Label>Unlimited Plan (Monthly)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPricing.unlimited_call_plan_monthly}
                        onChange={(e) => setEditingPricing({
                          ...editingPricing, 
                          unlimited_call_plan_monthly: parseFloat(e.target.value)
                        })}
                        data-testid="edit-unlimited-price"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditPricingOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdatePricing} disabled={loading} data-testid="confirm-update-pricing">
                    Update Pricing
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
