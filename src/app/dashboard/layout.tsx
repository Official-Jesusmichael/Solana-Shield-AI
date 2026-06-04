import { Logo } from '@/components/shared/Logo';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  ShieldAlert,
  Unplug,
  Settings,
  Scan,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');
  return (
    <SidebarProvider>
      <Sidebar className="border-r border-white/5 bg-black/20 backdrop-blur-3xl">
        <SidebarHeader className="p-6">
          <Logo />
        </SidebarHeader>
        <SidebarContent className="px-4 py-2">
          <SidebarMenu className="gap-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                href="/dashboard"
                isActive
                className="h-11 rounded-xl data-[active=true]:bg-primary/20 data-[active=true]:text-white data-[active=true]:border-white/5 border border-transparent transition-all"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="font-headline font-bold text-[11px] uppercase tracking-wider">Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" className="h-11 rounded-xl hover:bg-white/5 transition-all">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-headline font-bold text-[11px] uppercase tracking-wider">Forensic Threats</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" className="h-11 rounded-xl hover:bg-white/5 transition-all">
                <Unplug className="w-5 h-5" />
                <span className="font-headline font-bold text-[11px] uppercase tracking-wider">Uplink Connections</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-6">
          <SidebarMenu className="gap-4">
            <SidebarMenuItem>
              <SidebarMenuButton href="#" className="h-11 rounded-xl hover:bg-white/5 transition-all">
                <Settings className="w-5 h-5" />
                <span className="font-headline font-bold text-[11px] uppercase tracking-wider">System Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/[0.03] border border-white/5">
                <Avatar className="h-8 w-8 rounded-xl ring-1 ring-white/10">
                  {userAvatar && <AvatarImage src={userAvatar.imageUrl} data-ai-hint={userAvatar.imageHint} />}
                  <AvatarFallback className="bg-primary/20 text-[10px] font-black">AI</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-white tracking-tighter">Core Identity</span>
                  <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">Verified Human</span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <header className="flex h-20 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <SidebarTrigger />
            </div>
            <div className="hidden text-xs font-black md:block font-headline uppercase tracking-[0.3em] text-white/40">
              Protocol: <span className="text-white">Security Intelligence Dashboard</span>
            </div>
          </div>
          <Button asChild variant="default" className="h-10 rounded-xl px-6">
            <Link href="/scan">
              <Scan className="mr-2 h-4 w-4" />
              Initiate Neural Audit
            </Link>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
