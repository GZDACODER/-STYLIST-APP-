// Frosted mockups of real Clientele screens (public/home/*.webp, taken from
// the live demo with scripts/capture-homepage-shots.cjs; retake them when the
// app's look changes).

// The redesigned dashboard in a frosted browser window.
// hideOnPhones: phones get a tiny placeholder instead (the hero shows a
// phone screen there), so the big picture isn't downloaded for nothing.
export function DeskShot({ src, alt, priority = false, hideOnPhones = false }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/home/${src}.webp`}
      alt={alt}
      width={1600}
      height={1000}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
  return (
    <figure className="ln-desk">
      <div className="ln-desk-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>clientelesuite.com/dashboard</span>
      </div>
      {hideOnPhones ? (
        <picture>
          <source media="(max-width: 767px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
          {img}
        </picture>
      ) : (
        img
      )}
    </figure>
  );
}

// A phone screen (booking page, public profile) in a frosted phone frame.
export function PhoneShot({ src, alt, height = 1056, priority = false }) {
  return (
    <figure className="ln-phone">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/home/${src}.webp`}
        alt={alt}
        width={620}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
      />
    </figure>
  );
}
