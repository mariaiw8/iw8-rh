import "./globals.css";

export const metadata = {
  title: "IW8 - Sistema de RH",
  description: "Sistema de gestão de recursos humanos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}