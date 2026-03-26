import { useState } from 'react';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar } from 'lucide-react';
import EventsSkeleton from '@/components/skeletons/EventsSkeleton';

export default function Events() {
  const { visibleEvents, participants, createEvent, currentUser, isLoading } = useMockData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', location: '' });

  if (isLoading) return <EventsSkeleton />;

  const handleCreate = () => {
    if (!form.name || !form.date) return;
    createEvent({ ...form, organization_id: currentUser.organization_id || 'org-1' });
    setForm({ name: '', date: '', location: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Wydarzenia</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Lista Twoich wydarzeń. Kliknij wydarzenie, aby zobaczyć szczegóły i statystyki.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="self-start sm:self-auto"><Plus className="h-4 w-4 mr-1" /> Nowe wydarzenie</Button>
      </div>

      {visibleEvents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">Nie masz jeszcze żadnych wydarzeń</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Kliknij „Nowe wydarzenie" aby utworzyć pierwsze.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleEvents.map(e => {
          const ep = participants.filter(p => p.event_id === e.id);
          const ci = ep.filter(p => p.status === 'checked_in').length;
          return (
            <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => navigate(`/events/${e.id}`)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{e.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{e.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{e.location}</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Odprawieni</span>
                    <span className="font-semibold tabular-nums">{ci}/{ep.length}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${ep.length ? (ci / ep.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nowe wydarzenie</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Bieg Wiosenny" /></div>
            <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Lokalizacja</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="np. Kraków, Błonia" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!form.name || !form.date} className="h-11 sm:h-10">Utwórz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
