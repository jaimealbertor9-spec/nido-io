'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface SinglePropertyChartProps {
  views: number;
  leads: number;
  interactions: number;
  saves: number;
  titulo: string;
}

export function AnalyticsCharts({ views, leads, interactions, saves, titulo }: SinglePropertyChartProps) {
  const data = [
    { name: 'Visualizaciones', value: views, color: '#1A56DB' },
    { name: 'Contactos', value: leads, color: '#9333ea' },
    { name: 'Interacciones', value: interactions, color: '#059669' },
    { name: 'Guardados', value: saves, color: '#e11d48' },
  ];

  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 h-64 flex flex-col items-center justify-center text-gray-500">
        <p className="font-medium text-gray-700">Sin datos aún</p>
        <p className="text-sm mt-1">Las estadísticas aparecerán cuando tu inmueble reciba tráfico.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">
          Desglose de Métricas
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Rendimiento detallado de <span className="font-semibold text-gray-700">{titulo}</span>
        </p>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#6b7280', fontSize: 13 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}
            />
            <Bar dataKey="value" name="Métrica" radius={[8, 8, 0, 0]} barSize={56}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
