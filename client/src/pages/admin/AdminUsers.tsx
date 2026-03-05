/**
 * @file: AdminUsers.tsx
 * @description: Управление пользователями в панели администратора
 * @dependencies: use-admin.ts, AdminLayout.tsx, shadcn/ui
 * @created: 2026-02-23
 */

import { useState } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  useAdminUsers,
  useBlockUser,
  useUnblockUser,
  useMakeAdmin,
  useRemoveAdmin,
  useChangeTariff,
  type AdminUserRow,
} from "@/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShieldCheck, Ban, UserCheck, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Filter = "all" | "blocked" | "admins";

function UserCard({ user }: { user: AdminUserRow }) {
  const { toast } = useToast();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const makeAdmin = useMakeAdmin();
  const removeAdmin = useRemoveAdmin();
  const changeTariff = useChangeTariff();
  const [tariffDialogOpen, setTariffDialogOpen] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<string>(user.tariff || 'basic');
  const [subscriptionDate, setSubscriptionDate] = useState<Date | undefined>(
    user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : undefined
  );

  const handleBlock = async () => {
    try {
      await blockUser.mutateAsync(user.telegramUserId);
      toast({ title: "Пользователь заблокирован" });
    } catch (err) {
      toast({ title: "Ошибка блокировки", description: String(err), variant: "destructive" });
    }
  };

  const handleUnblock = async () => {
    try {
      await unblockUser.mutateAsync(user.telegramUserId);
      toast({ title: "Пользователь разблокирован" });
    } catch (err) {
      toast({ title: "Ошибка разблокировки", description: String(err), variant: "destructive" });
    }
  };

  const handleMakeAdmin = async () => {
    try {
      await makeAdmin.mutateAsync(user.telegramUserId);
      toast({ title: "Права администратора выданы" });
    } catch (err) {
      toast({ title: "Ошибка назначения", description: String(err), variant: "destructive" });
    }
  };

  const handleRemoveAdmin = async () => {
    try {
      await removeAdmin.mutateAsync(user.telegramUserId);
      toast({ title: "Права администратора сняты" });
    } catch (err) {
      toast({ title: "Ошибка снятия прав", description: String(err), variant: "destructive" });
    }
  };

  const handleChangeTariff = async () => {
    try {
      await changeTariff.mutateAsync({
        userId: user.telegramUserId as any,
        tariff: selectedTariff as any,
        subscriptionEndsAt: subscriptionDate?.toISOString(),
      });
      toast({ title: "Тариф обновлён" });
      setTariffDialogOpen(false);
    } catch (err) {
      toast({ 
        title: "Ошибка обновления тарифа", 
        description: String(err), 
        variant: "destructive" 
      });
    }
  };

  const handleActivateTrial = async () => {
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      
      await changeTariff.mutateAsync({
        userId: user.telegramUserId as any,
        tariff: 'standard',
        subscriptionEndsAt: trialEndDate.toISOString(),
      });
      
      toast({ title: "Trial активирован (14 дней)" });
    } catch (err) {
      toast({ 
        title: "Ошибка активации Trial", 
        description: String(err), 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium truncate">{user.telegramUserId}</span>
          <Badge variant={
            user.tariff === 'premium' ? 'default' : 
            user.tariff === 'standard' ? 'secondary' : 
            'outline'
          }>
            {user.tariff === 'premium' ? 'Премиум' : 
             user.tariff === 'standard' ? 'Стандарт' : 
             'Базовый'}
          </Badge>
          {user.isAdmin && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              <ShieldCheck className="h-3 w-3 mr-0.5" /> ADMIN
            </Badge>
          )}
          {user.isBlocked && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              <Ban className="h-3 w-3 mr-0.5" /> Заблокирован
            </Badge>
          )}
        </div>
        {user.objectTitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.objectTitle}</p>
        )}
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          <span>Акты: {user.actsCount}</span>
          <span>Сообщения: {user.messagesCount}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {user.isBlocked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnblock}
            disabled={unblockUser.isPending}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Разблокировать
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30">
                <Ban className="h-3.5 w-3.5 mr-1" />
                Заблокировать
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Заблокировать пользователя?</AlertDialogTitle>
                <AlertDialogDescription>
                  Пользователь {user.telegramUserId} потеряет доступ к приложению.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBlock}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Заблокировать
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {user.isAdmin ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline">
                Снять Admin
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Снять права администратора?</AlertDialogTitle>
                <AlertDialogDescription>
                  Пользователь {user.telegramUserId} потеряет доступ к панели администратора.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveAdmin}>Снять</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMakeAdmin}
            disabled={makeAdmin.isPending}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Admin
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setTariffDialogOpen(true)}
        >
          Тариф
        </Button>

        {!user.trialUsed && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleActivateTrial}
            disabled={changeTariff.isPending}
          >
            Активировать Trial
          </Button>
        )}
        {user.trialUsed && (
          <span className="text-xs text-muted-foreground">
            Trial использован
          </span>
        )}
      </div>

      <Dialog open={tariffDialogOpen} onOpenChange={setTariffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Управление тарифом</DialogTitle>
            <DialogDescription>
              Изменение тарифа пользователя {user.telegramUserId}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Тариф</label>
              <Select value={selectedTariff} onValueChange={setSelectedTariff}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Базовый</SelectItem>
                  <SelectItem value="standard">Стандарт</SelectItem>
                  <SelectItem value="premium">Премиум</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Подписка до</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !subscriptionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {subscriptionDate ? format(subscriptionDate, "PPP", { locale: ru }) : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={subscriptionDate}
                    onSelect={setSubscriptionDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTariffDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleChangeTariff} disabled={changeTariff.isPending}>
              {changeTariff.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsers() {
  const { data: users, isLoading, error } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = (users ?? []).filter((u) => {
    const matchSearch =
      !search || u.telegramUserId.includes(search) || (u.objectTitle ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "blocked" && u.isBlocked) ||
      (filter === "admins" && u.isAdmin);
    return matchSearch && matchFilter;
  });

  return (
    <AdminLayout title="Пользователи">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ID или объекту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1 border rounded-lg p-1 bg-muted/30 shrink-0">
            {(["all", "admins", "blocked"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  filter === f ? "bg-background shadow text-foreground" : "text-muted-foreground"
                }`}
              >
                {f === "all" ? "Все" : f === "admins" ? "Admin" : "Заблокированные"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
            Ошибка загрузки: {error.message}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Пользователи не найдены
          </div>
        )}

        {filtered.map((user) => (
          <UserCard key={user.telegramUserId} user={user} />
        ))}
      </div>
    </AdminLayout>
  );
}
