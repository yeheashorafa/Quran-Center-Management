"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { useTheme } from "@/lib/theme/theme-provider";

type DynamicLogoProps = {
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

const emptySubscribe = () => () => {};

export function DynamicLogo({
  alt,
  fill = true,
  width,
  height,
  sizes,
  className = "object-contain",
  priority = false,
}: DynamicLogoProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";
  const logoSrc = isDark ? "/brand/logo-dark.png" : "/brand/logo-light.png";

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    if (target.src.includes("logo-dark.png")) {
      target.src = "/brand/logo-light.png";
    } else if (target.src.includes("logo-light.png")) {
      target.src = "/brand/logo.png";
    }
  };

  if (fill) {
    return (
      <Image
        src={logoSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        onError={handleImageError}
      />
    );
  }

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width || 64}
      height={height || 64}
      className={className}
      priority={priority}
      onError={handleImageError}
    />
  );
}
