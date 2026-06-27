import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../types'

export default function TrendChart({ accent, data }: { accent: string; data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="tempGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor={accent} stopOpacity={0.34} />
            <stop offset="95%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="airTemp"
          name="空气温度"
          stroke={accent}
          strokeWidth={3}
          fill="url(#tempGradient)"
        />
        <Area
          type="monotone"
          dataKey="soilHumidity"
          name="土壤湿度"
          stroke="#0ea5e9"
          strokeWidth={2}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
