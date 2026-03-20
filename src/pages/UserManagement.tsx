import { useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Role } from '@/types';

const roleLabels: Record<Role, string> = { admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export default function UserManagement() {
  const { users, addUser, removeUser, changeRole, currentRole, currentUser } = useMockData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'scanner' as Role });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Editor can only see/manage scanners assigned to their events
  const visibleUsers = currentRole === 'admin'
    ? users
    : users.filter(u =>
        u.id === currentUser.id ||
        (u.role === 'scanner' && u.assigned_events.some(eid => currentUser.assigned_events.includes(eid)))
      );

  // Editor can only create scanners
  const creatableRoles: Role[] = currentRole === 'admin' ? ['scanner', 'editor'] : ['scanner'];

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    // When editor creates a scanner, assign to editor's events
    const assigned_events = currentRole === 'editor' ? [...currentUser.assigned_events] : [];
    addUser({ ...form, assigned_events });
    setForm({ name: '', email: '', role: 'scanner' });
    setOpen(false);
    toast({ title: 'Użytkownik dodany', description: 'Zaproszenie zostało wysłane (symulacja)' });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    removeUser(deleteId);
    setDeleteId(null);
    toast({ title: 'Użytkownik usunięty' });
  };

  // Editor can only change roles for their scanners, not for themselves or other editors
  const canManageUser = (userId: string) => {
    if (currentRole === 'admin') return true;
    const target = users.find(u => u.id === userId);
    return target && target.role === 'scanner' && target.assigned_events.some(eid => currentUser.assigned_events.includes(eid));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Użytkownicy</h1>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Dodaj użytkownika</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {canManageUser(u.id) ? (
                      <Select value={u.role} onValueChange={v => changeRole(u.id, v as Role)}>
                        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(currentRole === 'admin' ? ['admin', 'editor', 'scanner'] as Role[] : ['scanner'] as Role[]).map(r => (
                            <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{roleLabels[u.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManageUser(u.id) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj użytkownika</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Imię</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div>
              <Label>Rola</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={!form.name || !form.email}>Dodaj i wyślij zaproszenie</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Potwierdź usunięcie</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunąć tego użytkownika?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleDelete}>Usuń</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
