import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { migrationApi } from '../lib/api';

interface ExportData {
  members: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  settlements: Record<string, unknown>[];
}

export function DataMigration() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleExport = async () => {
    setExporting(true);
    setStatus('Exporting from Firebase...');

    try {
      const data: ExportData = { members: [], bills: [], settlements: [] };

      // Export members
      const membersSnapshot = await getDocs(collection(db, 'members'));
      membersSnapshot.forEach((doc) => {
        const docData = doc.data();
        data.members.push({
          id: doc.id,
          name: docData.name,
          mortgageShare: docData.mortgageShare || 0,
          email: docData.email || null,
          avatarColor: docData.avatarColor || null,
          defaultSplitPercentage: docData.defaultSplitPercentage || null,
          credit: docData.credit || 0,
          venmoHandle: docData.venmoHandle || null,
        });
      });

      // Export bills
      const billsSnapshot = await getDocs(collection(db, 'bills'));
      billsSnapshot.forEach((doc) => {
        const docData = doc.data();
        data.bills.push({
          id: doc.id,
          name: docData.name,
          amount: docData.amount,
          dueDate: docData.dueDate,
          category: docData.category,
          splitType: docData.splitType,
          paidBy: docData.paidBy || null,
          paidContributions: docData.paidContributions || null,
          contributionDates: docData.contributionDates || null,
          creditUsed: docData.creditUsed || null,
          creditEarned: docData.creditEarned || null,
          coverageAllocations: docData.coverageAllocations || null,
          paidDate: docData.paidDate || null,
          isPaid: docData.isPaid || false,
          status: docData.status || 'pending',
          recurring: docData.recurring || false,
          frequency: docData.frequency || 'once',
          customSplits: docData.customSplits || null,
          items: docData.items || null,
          notes: docData.notes || null,
          createdAt: docData.createdAt || new Date().toISOString(),
          updatedAt: docData.updatedAt || new Date().toISOString(),
        });
      });

      // Export settlements
      const settlementsSnapshot = await getDocs(collection(db, 'settlementRecords'));
      settlementsSnapshot.forEach((doc) => {
        const docData = doc.data();
        data.settlements.push({
          id: doc.id,
          fromId: docData.fromId,
          toId: docData.toId,
          amount: docData.amount,
          type: docData.type,
          note: docData.note || null,
          createdAt: docData.createdAt || new Date().toISOString(),
        });
      });

      setExportData(data);
      setStatus(`Exported: ${data.members.length} members, ${data.bills.length} bills, ${data.settlements.length} settlements`);
    } catch (error) {
      console.error('Export error:', error);
      setStatus(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!exportData) {
      setStatus('No data to import. Export first.');
      return;
    }

    setImporting(true);
    setStatus('Importing to Postgres...');

    try {
      const result = await migrationApi.migrate(exportData as unknown as Parameters<typeof migrationApi.migrate>[0]);
      setStatus(
        `Migration complete! Imported: ${result.imported.members} members, ${result.imported.bills} bills, ${result.imported.settlements} settlements`
      );
    } catch (error) {
      console.error('Import error:', error);
      setStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firebase-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="max-w-lg mx-auto mt-8">
      <CardHeader>
        <CardTitle>Data Migration</CardTitle>
        <CardDescription>
          Migrate data from Firebase to Vercel Postgres
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={exporting || importing}>
            {exporting ? 'Exporting...' : '1. Export from Firebase'}
          </Button>
          {exportData && (
            <Button variant="outline" onClick={handleDownload}>
              Download JSON
            </Button>
          )}
        </div>

        {exportData && (
          <Button onClick={handleImport} disabled={exporting || importing}>
            {importing ? 'Importing...' : '2. Import to Postgres'}
          </Button>
        )}

        {status && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
            {status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
