import Logo from "@/components/Logo";

// Home, log in, sign up and the stylist's dashboard.
export default function SiteLayout({ children }) {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
