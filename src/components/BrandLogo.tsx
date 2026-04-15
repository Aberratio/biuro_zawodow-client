import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "long" | "short";
  className?: string;
  imageClassName?: string;
  alt?: string;
};

const logoSources = {
  long: "/logo_long_desktop.png",
  short: "/logo_short.png",
} as const;

export function BrandLogo({
  variant = "long",
  className,
  imageClassName,
  alt = "Panel Zawodow Eventdesk",
}: BrandLogoProps) {
  if (variant === "long") {
    return (
      <picture className="contents">
        <source srcSet="/logo_long_desktop.png" />
        <img
          src={logoSources.long}
          alt={alt}
          className={cn("block", className, imageClassName)}
          draggable={false}
        />
      </picture>
    );
  }

  return (
    <img
      src={logoSources.short}
      alt={alt}
      className={cn("block", className, imageClassName)}
      draggable={false}
    />
  );
}
