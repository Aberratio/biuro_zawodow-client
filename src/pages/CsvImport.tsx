import { useState, useCallback } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { demoCsvData } from '@/data/mockData';

interface CsvRow { name: string; email: string; valid: boolean; duplicate: boolean; }

export default function CsvImport() {
  const { importParticipants, selectedEventId, participants } = useMockData();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const existingEmails = new Set(participants.filter(p => p.event_id === selectedEventId).map(p => p.email));

  const loadDemo = useCallback(() => {
    const parsed: CsvRow[] = demoCsvData.map(d => ({
      ...d,
      valid: !!d.email,
      duplicate: existingEmails.has(d.email),
    }));
    setRows(parsed);
  }, [existingEmails]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    loadDemo();
    toast({ title: 'Plik załadowany (demo)', description: 'Użyto danych demonstracyjnych' });
  }, [loadDemo]);

  const handleImport = () => {
    setImporting(true);
    setTimeout(() => {
      const validRows = rows.filter(r => r.valid && !r.duplicate).map(r => ({ name: r.name, email: r.email }));
      const count = importParticipants(validRows, selectedEventId);
      setImporting(false);
      setRows([]);
      toast({ title: `Zaimportowano ${count} uczestników` });
    }, 1000);
  };

  const validCount = rows.filter(r => r.valid && !r.duplicate).length;
  const errorCount = rows.filter(r => !r.valid || r.duplicate).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Import CSV</h1>

      {rows.length === 0 ? (
        <>
          <Card
            className={`border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Przeciągnij plik CSV tutaj</p>
              <p className="text-xs text-muted-foreground mt-1">Format: name, email</p>
            </CardContent>
          </Card>
          <div className="text-center">
            <Button variant="outline" onClick={loadDemo}><FileText className="h-4 w-4 mr-1" /> Załaduj dane demo</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> {validCount} poprawnych</Badge>
            {errorCount > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {errorCount} błędów</Badge>}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Podgląd danych</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={!r.valid || r.duplicate ? 'bg-destructive/5' : ''}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.email || <span className="text-destructive text-xs">Brak email</span>}</TableCell>
                      <TableCell>
                        {!r.valid && <Badge variant="destructive" className="text-[10px]">Błąd</Badge>}
                        {r.duplicate && <Badge variant="destructive" className="text-[10px]">Duplikat</Badge>}
                        {r.valid && !r.duplicate && <Badge variant="default" className="text-[10px]">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Importuj {validCount} uczestników
            </Button>
            <Button variant="outline" onClick={() => setRows([])}>Anuluj</Button>
          </div>
        </>
      )}
    </div>
  );
}
