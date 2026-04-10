import { MessageSquare, Package, Users, Calendar, BookUser, Trash2, Settings2, ScanLine } from "lucide-react";

const sections = [
  {
    icon: Package,
    title: "Control General",
    description:
      "El dashboard principal muestra un resumen del estado del deposito: stock total, cantidad de clientes, alertas activas y elementos en papelera. Tambien muestra los clientes con mayor volumen y el stock mas antiguo.",
  },
  {
    icon: Settings2,
    title: "Control Operativo",
    description:
      "Aca podes gestionar los bultos individualmente: agregar nuevos, programar devoluciones, marcar como devueltos o mover a la papelera. Usa los filtros para ver solo los almacenados o los que tienen retorno programado.",
  },
  {
    icon: Users,
    title: "Clientes",
    description:
      "Gestion completa de clientes: crear, editar, buscar y eliminar. Cada cliente tiene su ficha con datos de contacto y la lista de bultos asociados.",
  },
  {
    icon: Calendar,
    title: "Agenda",
    description:
      "Programacion semanal de devoluciones por cliente. Configura los dias de la semana en que cada cliente recibe sus paquetes y recibe recordatorios automaticos.",
  },
  {
    icon: BookUser,
    title: "Directorio",
    description:
      "Consulta rapida de todos los clientes con su informacion de contacto, stock actual, historial de devoluciones del ultimo mes y agenda semanal. Permite importar clientes masivamente desde un archivo Excel y exportar el listado completo.",
  },
  {
    icon: ScanLine,
    title: "Escáner QR",
    description:
      "Escaneá códigos QR o de barras con la cámara del dispositivo para buscar bultos rápidamente. También permite búsqueda manual por código de barras o tracking ID.",
  },
  {
    icon: Trash2,
    title: "Papelera",
    description:
      "Los clientes y bultos eliminados van a la papelera. Desde aca podes restaurarlos o eliminarlos permanentemente.",
  },
];

export default function AsistentePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Asistente</h1>
      </div>

      <div className="bg-card rounded-2xl border border-card-border p-6 animate-fade-in">
        <h2 className="text-lg font-bold text-foreground mb-2">
          Bienvenido a Logistica Hogareno
        </h2>
        <p className="text-sm text-muted">
          Este sistema te permite gestionar el stock de tu deposito, llevar un
          registro de clientes y sus bultos, programar devoluciones y mantener
          todo organizado. A continuacion encontras una guia de cada seccion.
        </p>
      </div>

      <div className="space-y-3 stagger-children">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-card rounded-2xl border border-card-border p-5 flex gap-4 hover:border-accent/30 transition-all duration-300 animate-fade-in"
          >
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <section.icon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {section.title}
              </h3>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                {section.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
