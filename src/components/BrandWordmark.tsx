import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  compact?: boolean;
  className?: string;
  imageClassName?: string;
};

export function BrandWordmark({
  compact = false,
  className,
  imageClassName,
}: BrandWordmarkProps) {
  if (compact) {
    return (
      <BrandLogo
        variant="short"
        className={cn(
          "h-11 w-11 object-contain",
          className,
        )}
        imageClassName={imageClassName}
      />
    );
  }

  return (
    <BrandLogo
      variant="long"
      className={cn(
        "h-9 w-auto object-contain",
        className,
      )}
      imageClassName={imageClassName}
    />
  );
}
