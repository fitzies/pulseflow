import Nav from "@/components/nav";

export default function AutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="mt-14">{children}</main>
    </>
  );
}
