import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Wallet, Plus, CreditCard, Bitcoin, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';
import api from '../api/client';
import { useAuth } from '../api/AuthContext';
import { format } from 'date-fns';

const WalletSection = () => {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [usdtTxid, setUsdtTxid] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadTransactions();
  }, []);

  const loadWalletData = async () => {
    try {
      const response = await api.get('/wallet/balance');
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await api.get('/wallet/transactions?limit=10');
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const handleTopup = async (method) => {
    if (!topupAmount || parseFloat(topupAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(topupAmount),
        method: method
      };

      if (method === 'usdt' && usdtTxid) {
        payload.txid = usdtTxid;
      }

      const response = await api.post('/wallet/topup', payload);
      toast.success(response.data.message);
      setTopupAmount('');
      setUsdtTxid('');
      setShowTopup(false);
      loadWalletData();
      loadTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Topup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="wallet-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-5 h-5" />
            Wallet
          </CardTitle>
          <Dialog open={showTopup} onOpenChange={setShowTopup}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="topup-button">
                <Plus className="w-4 h-4 mr-1" />
                Top Up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Top Up Wallet</DialogTitle>
                <DialogDescription>
                  Add funds to your wallet to make calls and send SMS
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="google_play" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="google_play" data-testid="tab-google-play">Google Play</TabsTrigger>
                  <TabsTrigger value="usdt" data-testid="tab-usdt">USDT (TRC20)</TabsTrigger>
                </TabsList>

                <TabsContent value="google_play" className="space-y-4">
                  <div>
                    <Label htmlFor="amount-gp">Amount (USD)</Label>
                    <Input
                      id="amount-gp"
                      type="number"
                      placeholder="100.00"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      data-testid="topup-amount-input"
                    />
                  </div>
                  {topupAmount && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                      <p className="text-blue-800 dark:text-blue-200">
                        Total charge: <span className="font-bold">${(parseFloat(topupAmount) * 1.15).toFixed(2)}</span>
                      </p>
                      <p className="text-blue-600 dark:text-blue-300 text-xs mt-1">
                        (includes 15% service fee)
                      </p>
                      <p className="text-blue-800 dark:text-blue-200 mt-2">
                        Wallet credit: <span className="font-bold">${parseFloat(topupAmount).toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => handleTopup('google_play')}
                    disabled={loading}
                    className="w-full"
                    data-testid="submit-google-play"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {loading ? 'Processing...' : 'Pay with Google Play'}
                  </Button>
                </TabsContent>

                <TabsContent value="usdt" className="space-y-4">
                  <div>
                    <Label htmlFor="amount-usdt">Amount (USDT)</Label>
                    <Input
                      id="amount-usdt"
                      type="number"
                      placeholder="100.00"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      data-testid="usdt-amount-input"
                    />
                  </div>
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-2">Send USDT (TRC20) to:</p>
                    <p className="font-mono text-xs break-all bg-white dark:bg-gray-900 p-2 rounded">
                      {process.env.REACT_APP_USDT_WALLET_ADDRESS}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="txid">Transaction ID (TXID)</Label>
                    <Input
                      id="txid"
                      placeholder="Enter transaction hash"
                      value={usdtTxid}
                      onChange={(e) => setUsdtTxid(e.target.value)}
                      data-testid="usdt-txid-input"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
                    <p className="text-amber-800 dark:text-amber-200">
                      Your topup will be processed after admin approval (usually within 24 hours).
                    </p>
                  </div>
                  <Button
                    onClick={() => handleTopup('usdt')}
                    disabled={loading}
                    className="w-full"
                    data-testid="submit-usdt"
                  >
                    <Bitcoin className="w-4 h-4 mr-2" />
                    {loading ? 'Submitting...' : 'Submit for Approval'}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {/* Balance - Compact */}
        <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
            <p className="text-2xl font-bold font-mono" data-testid="wallet-balance">
              ${balance.toFixed(2)}
            </p>
          </div>
          {user?.active_plan && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Plan: {user.active_plan}
            </p>
          )}
        </div>

        {/* Collapsible Recent Transactions */}
        <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-8 px-2">
              <span className="text-sm font-medium">Transaction History ({transactions.length})</span>
              {showTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {transactions.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-2">No transactions yet</p>
            ) : (
              <div className="space-y-1 mt-2 max-h-40 overflow-auto">
                {transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent/50 text-sm"
                    data-testid={`transaction-${tx.id}`}
                  >
                    <div>
                      <p className="font-medium capitalize text-xs">{tx.method || tx.type}</p>
                      <p className="text-[10px] text-gray-500">
                        {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs font-medium ${
                          tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-500 capitalize">{tx.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default WalletSection;