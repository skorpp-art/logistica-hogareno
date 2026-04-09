import { MessageSquare, Package, Users, Calendar, ScanLine, Trash2, Settings2 } from "lucide-react";

const sections = [
  {
    icon: Package,
    title: "Control General",
    description:
      "El dashboard principal muestra un resumen del estado del depósito: stock total, cantidad de clientes, alertas activas y elementos en papelera. También muestra los clientes con mayor volumen y el stock más antiguo.",
  },
  {
    icon: Settings2,
    title: "Control Operativo",
    description:
      "Acá podés gestionar los bultos individualmente: agregar nuevos, programar devoluciones, marcar como devueltos o mover a la papelera. Usá los filtros para ver solo los almacenados o los que tienen retorno programado.",
  },
  {
    icon: Users,
    title: "Clientes",
    description:
      "Gestión completa de clientes: crear, editar, buscar y eliminar. Cada cliente tiene su ficha con datos de contacto y la lista de bultos asociados.",
  },
  {
    icon: Calendar,
    title: "Agenda",
    description:
      "Calendario de eventos programados: devoluciones, retiros y otros. Podés crear eventos asociados a clientes y marcarlos como completados.",
  },
  {
    icon: ScanLine,
    title: "Escáner",
    description:
      "Buscá bultos por su código de barras. Ingresá el código para ver los detalles del bulto y realizar acciones rápidas como marcar como devuelto.",
  },
  {
    icon: Trash2,
    title: "Papelera",
    description:
      "Los clientes y bultos eliminados van a la papelera. Desde acá podés restaurarlos o eliminarlos permanentemente.",
  },
];

export default function AsistentePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Asistente</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Bienvenido a Logística Hogareño
        </h2>
        <p className="text-sm text-gray-600">
          Este sistema te permite gestionar el stock de tu depósito, llevar un
          registro de clientes y sus bultos, programar devoluciones y mantener
          todo organizado. A continuación encontrás una guía de cada sección.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl shadow-sm p-6 flex gap-4"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <section.icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {section.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {section.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
