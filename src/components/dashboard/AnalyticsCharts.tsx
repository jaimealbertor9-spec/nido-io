'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartProps {
  data: {
    name: string;
    ShortName: string;
    Visualizaciones: number;
    Interacciones: number;
    Guardados: number;
  }[];
}

export function AnalyticsCharts({ data }: AnalyticsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 h-64 flex flex-col items-center justify-center text-gray-500">
        <p className="font-medium text-gray-700">Sin datos para mostrar</p>
        <p className="text-sm mt-1">Comparativa disponible cuando tus inmuebles reciban tráfico.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Rendimiento por Propiedad (Top 7)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Compara visualizaciones, contactos (WhatsApp/Llamadas/Mensajes) y usuarios que agregaron a favoritos.
          </p>
        </div>
      </div>
      
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="ShortName" 
              tick={{ fill: '#6b7280', fontSize: 13 }} 
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              dy={15}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 13 }} 
              tickLine={false}
              axisLine={false}
              dx={-10}
              allowDecimals={false}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #e5e7eb', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
              }}
              labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Bar 
              dataKey="Visualizaciones" 
              name="Visualizaciones" 
              fill="#1A56DB" 
              radius={[6, 6, 0, 0]} 
              barSize={32} 
            />
            <Bar 
              dataKey="Interacciones" 
              name="Total Interacciones" 
              fill="#9333ea" 
              radius={[6, 6, 0, 0]} 
              barSize={32} 
            />
            <Bar 
              dataKey="Guardados" 
              name="Guardados" 
              fill="#e11d48" 
              radius={[6, 6, 0, 0]} 
              barSize={32} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
