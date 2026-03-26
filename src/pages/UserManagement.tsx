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
import { Plus, Trash2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Role } from '@/types';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

const roleLabels: Record<Role, string> = { superadmin: 'Superadmin', admin: 'Admin', editor: 'Organizator', scanner: 'Skaner' };
const roleDescriptions: Record<Role, string> = {
  superadmin: 'Pełny dostęp do systemu i wszystkich organizacji',
  admin: 'Zarządzanie wydarzeniami i użytkownikami w swojej organizacji',
  editor: 'Organizacja wydarzeń, import uczestników, wysyłka QR',
  scanner: 'Skanowanie kodów QR i odprawa uczestników na miejscu',
};

export default function UserManagement() {
  const { users, addUser, removeUser, changeRole, currentRole, currentUser, isLoading } = useMockData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: 'demo123', role: 'scanner' as Role });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return <TableSkeleton rows={5} cols={3} subtitle="" />;

  const visibleUsers = (() => {
    if (currentRole === 'superadmin') return users;
    if (currentRole === 'admin') return users.filter(u => u.organization_id === currentUser.organization_id);
    return users.filter(u =>
      u.id === currentUser.id ||
      (u.role === 'scanner' && u.assigned_events.some(eid => currentUser.assigned_events.includes(eid)))
    );
  })();

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
    return target.role === 'scanner' && target.assigned_events.some(eid => currentUser.assigned_events.includes(eid));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Użytkownicy</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Zarządzaj kontami użytkowników i ich uprawnieniami.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="self-start sm:self-auto"><Plus className="h-4 w-4 mr-1" /> Dodaj użytkownika</Button>
      </div>

      {/* Role descriptions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-xs">Role w systemie:</p>
              {creatableRoles.map(r => (
                <p key={r}><strong>{roleLabels[r]}</strong> — {roleDescriptions[r]}</p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{u.name}</span>
                      <span className="block sm:hidden text-xs text-muted-foreground truncate">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell>
                    {canManageUser(u.id) ? (
                      <Select value={u.role} onValueChange={v => changeRole(u.id, v as Role)}>
                        <SelectTrigger className="h-8 w-[120px] sm:w-[140px] text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {creatableRoles.map(r => (
                            <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">{roleLabels[u.role]}</Badge>
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
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
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
              <p className="text-[10px] text-muted-foreground mt-1">{roleDescriptions[form.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!form.name || !form.email} className="h-11 sm:h-10">Dodaj użytkownika</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Potwierdź usunięcie</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunąć tego użytkownika? Ta akcja jest nieodwracalna.</p>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 sm:h-10">Anuluj</Button>
            <Button variant="destructive" onClick={handleDelete} className="h-11 sm:h-10">Usuń</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
