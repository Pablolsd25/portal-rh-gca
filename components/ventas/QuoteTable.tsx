import type { ReactNode } from 'react';

type Props = {
  title?: string;
  headers: string[];
  rows: ReactNode[];
  emptyMessage: string;
};

export default function QuoteTable({ title, headers, rows, emptyMessage }: Props) {
  return (
    <div>
      {title && (
        <div className="px-4 py-2 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
      )}
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-3 py-2 text-[10px] font-semibold text-left uppercase text-slate-600 tracking-wide"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
