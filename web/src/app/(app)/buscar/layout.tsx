import { Suspense } from "react";
import { SearchBox, SearchBoxFallback } from "@/components/SearchBox";

export default function SearchLayout({ children }: LayoutProps<"/buscar">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="animate-fade-up">
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
