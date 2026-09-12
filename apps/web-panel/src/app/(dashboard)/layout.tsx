import Header from "@/components/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col font-sans overflow-x-hidden w-full">
      <Header />
      <main className="flex-1 p-3 sm:p-6 relative w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
