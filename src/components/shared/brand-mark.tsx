import Image from "next/image";
import { appConfig } from "@/config/app";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <div className="flex items-center">
        <div className="relative size-24 sm:size-28 shrink-0">
          <Image
            src="/brand/logo.png"
            alt={`شعار ${appConfig.centerName}`}
            fill
            sizes="112px"
            className="object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative size-56">
        <Image
          src="/brand/logo.png"
          alt={`شعار ${appConfig.centerName}`}
          fill
          sizes="224px"
          className="object-contain"
        />
      </div>
    </div>
  );
}
