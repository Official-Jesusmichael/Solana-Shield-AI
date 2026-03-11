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
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                href="/dashboard"
                isActive
                tooltip="Dashboard"
              >
                <LayoutDashboard />
                Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="Threats">
                <ShieldAlert />
                Threats
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="Connections">
                <Unplug />
                Connections
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="Settings">
                <Settings />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#">
                <Avatar className="h-7 w-7">
                  {userAvatar && <AvatarImage src={userAvatar.imageUrl} data-ai-hint={userAvatar.imageHint} />}
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span>User Profile</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center justify-between border-b px-6">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <div className="hidden text-lg font-semibold md:block font-headline">
            Security Dashboard
          </div>
          <Button asChild className="font-headline">
            <Link href="/dashboard">
              <Scan className="mr-2 h-4 w-4" />
              Scan Again
            </Link>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
