import { BrandLockup } from "@/components/ui/brand-lockup";

export function ChatsHeader({ title }: { title: string }) {
  return (
    <header data-slot="chats-header" className="chats-header">
      <div>
        <BrandLockup />
        <h1 className="chats-tab-title">{title}</h1>
      </div>
    </header>
  );
}
