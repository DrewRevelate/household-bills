import type { Bill, Person } from '@/lib/types';
import { calculateBalances, calculateSettlements } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface BalancesSummaryProps {
  bills: Bill[];
  members: Person[];
}

export function BalancesSummary({ bills, members }: BalancesSummaryProps) {
  const balances = calculateBalances(bills, members);
  const settlements = calculateSettlements(bills, members);

  const paidBillsCount = bills.filter((b) => b.isPaid).length;
  const unpaidBillsCount = bills.filter((b) => !b.isPaid).length;
  const totalUnpaid = bills
    .filter((b) => !b.isPaid)
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{unpaidBillsCount}</p>
            <p className="text-sm text-muted-foreground">Unpaid Bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">${totalUnpaid.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total Due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{paidBillsCount}</p>
            <p className="text-sm text-muted-foreground">Paid This Period</p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Individual Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {balances.map((balance) => (
              <div key={balance.personId} className="flex items-center justify-between">
                <span className="font-medium">{balance.personName}</span>
                <span
                  className={`tabular-nums ${
                    balance.owes > 0.01
                      ? 'text-amber-600'
                      : balance.owes < -0.01
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {balance.owes > 0.01
                    ? `Owes $${balance.owes.toFixed(2)}`
                    : balance.owes < -0.01
                    ? `Owed $${Math.abs(balance.owes).toFixed(2)}`
                    : 'Settled'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settlement Recommendations */}
      {settlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Settle Up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settlements.map((settlement, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-md bg-muted/50 p-3"
                >
                  <span className="font-medium">{settlement.from}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{settlement.to}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    ${settlement.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              These payments will settle all outstanding balances from paid bills.
            </p>
          </CardContent>
        </Card>
      )}

      {settlements.length === 0 && paidBillsCount > 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">All settled up!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
