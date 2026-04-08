import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Compass, MapPinned } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <StatusPage
      code="404"
      eyebrow="Trasa Nie Istnieje"
      title="Ta strona zgubiła numer startowy"
      description={`Adres ${location.pathname} nie prowadzi do żadnego ekranu. Wygląda na to, że ktoś pomylił trasę albo meta została przeniesiona.`}
      hint="Możesz wrócić do panelu głównego albo zajrzeć na zmierzymyczas.pl, gdzie znajdziesz główne informacje i kontakt."
      icon={
        <div className="relative">
          <Compass className="h-8 w-8" />
          <MapPinned className="absolute -bottom-2 -right-2 h-4 w-4 text-primary-foreground/80" />
        </div>
      }
    />
  );
};

export default NotFound;
