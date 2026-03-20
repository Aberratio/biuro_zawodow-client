import { useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent } from '@/components/ui/card';
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

const roleLabels: Record<Role, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };

export default function UserManagement() {
  const { users, addUser, removeUser, changeRole, currentRole, currentUser } = useMockData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: 'demo123', role: 'scanner' as Role });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter visible users by role hierarchy and organization
  const visibleUsers = (() => {
    if (currentRole === 'superadmin') return users;
    if (currentRole === 'admin') return users.filter(u => u.organization_id === currentUser.organization_id);
    // editor sees themselves + their scanners
    return users.filter(u =>
      u.id === currentUser.id ||
      (u.role === 'scanner' && u.assigned_events.some(eid => currentUser.assigned_events.includes(eid)))
    );
  })();

  // Creatable roles based on current user role
  const creatableRoles: Role[] = (() => {
    if (currentRole === 'superadmin') return ['admin', 'editor', 'scanner'];
    if (currentRole === 'admin') return ['editor', 'scanner'];
    return ['scanner'];
  })();

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    const assigned_events = currentRole === 'editor' ? [...currentUser.assigned_events] : [];
    const organization_id = currentRole === 'superadmin' ? undefined : currentUser.organization_id;
    addUser({ ...form, organization_id, assigned_events });
    setForm({ name: '', email: '', password: 'demo123', role: 'scanner' });
    setOpen(false);
    toast({ title: 'Użytkownik dodany', description: 'Konto zostało utworzone' });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    removeUser(deleteId);
    setDeleteId(null);
    toast({ title: 'Użytkownik usunięty' });
  };

  const canManageUser = (userId: string) => {
    if (currentRole === 'superadmin') return true;
    if (userId === currentUser.id) return false;
    const target = users.find(u => u.id === userId);
    if (!target) return false;
    if (currentRole === 'admin') return target.organization_id === currentUser.organization_id && target.role !== 'superadmin' && target.role !== 'admin';
    // editor can manage their scanners
    return target.role === 'scanner' && target.assigned_events.some(eid => currentUser.assigned_events.includes(eid));
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
                          {creatableRoles.map(r => (
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
            <div><Label>Hasło</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
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
          <DialogFooter><Button onClick={handleAdd} disabled={!form.name || !form.email}>Dodaj użytkownika</Button></DialogFooter>
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
