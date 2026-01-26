import Nav from "@/components/nav";

export default function ExecutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav layout="Executions" />
      <main className="mt-4">{children}</main>
    </>
  );
}
