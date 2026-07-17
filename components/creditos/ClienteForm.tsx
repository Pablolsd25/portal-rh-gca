'use client';

import Link from 'next/link';
import type { ChangeEvent, FormEvent } from 'react';

export type ClienteFormData = {
  id?: string;
  full_name: string;
  phone_number: string;
  email: string;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  status: string;
};

type Props = {
  formData: ClienteFormData;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent) => void;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  mode?: 'add' | 'edit';
  cancelHref: string;
};

const inputClass =
  'block w-full px-3 py-2 mt-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 disabled:bg-slate-50';

const smallInputClass =
  'block w-full px-2 py-1.5 mt-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 disabled:bg-slate-50';

export default function ClienteForm({
  formData,
  handleChange,
  handleSubmit,
  loading,
  error,
  successMessage,
  mode = 'add',
  cancelHref,
}: Props) {
  const isEditMode = mode === 'edit';

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 md:p-6 space-y-4 bg-white border border-slate-200 rounded-xl"
    >
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
          Nombre Completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="full_name"
          id="full_name"
          required
          value={formData.full_name}
          onChange={handleChange}
          disabled={loading}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="phone_number" className="block text-sm font-medium text-slate-700">
          Teléfono <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phone_number"
          id="phone_number"
          required
          value={formData.phone_number}
          onChange={handleChange}
          disabled={loading}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Correo Electrónico
        </label>
        <input
          type="email"
          name="email"
          id="email"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
          className={inputClass}
        />
      </div>

      <fieldset className="p-4 border border-slate-200 rounded-xl">
        <legend className="px-1 text-sm font-medium text-slate-700">Dirección</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="address_street" className="block text-xs text-slate-600">
              Calle
            </label>
            <input
              type="text"
              name="address_street"
              id="address_street"
              value={formData.address_street}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
          <div>
            <label htmlFor="address_number" className="block text-xs text-slate-600">
              Número (Ext/Int)
            </label>
            <input
              type="text"
              name="address_number"
              id="address_number"
              value={formData.address_number}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
          <div>
            <label htmlFor="address_neighborhood" className="block text-xs text-slate-600">
              Colonia
            </label>
            <input
              type="text"
              name="address_neighborhood"
              id="address_neighborhood"
              value={formData.address_neighborhood}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
          <div>
            <label htmlFor="address_postal_code" className="block text-xs text-slate-600">
              Código Postal
            </label>
            <input
              type="text"
              name="address_postal_code"
              id="address_postal_code"
              value={formData.address_postal_code}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
          <div>
            <label htmlFor="address_city" className="block text-xs text-slate-600">
              Municipio
            </label>
            <input
              type="text"
              name="address_city"
              id="address_city"
              value={formData.address_city}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
          <div>
            <label htmlFor="address_state" className="block text-xs text-slate-600">
              Estado
            </label>
            <input
              type="text"
              name="address_state"
              id="address_state"
              value={formData.address_state}
              onChange={handleChange}
              disabled={loading}
              className={smallInputClass}
            />
          </div>
        </div>
      </fieldset>

      {isEditMode && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Estatus
          </label>
          <select
            name="status"
            id="status"
            value={formData.status}
            onChange={handleChange}
            disabled={loading}
            className={`${inputClass} bg-white`}
          >
            <option value="potencial">Potencial</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {successMessage && <p className="mt-2 text-sm text-emerald-600">{successMessage}</p>}

      <div className="flex justify-end gap-3 pt-3">
        <Link
          href={cancelHref}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={loading || !!successMessage}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300"
        >
          {loading ? 'Guardando...' : isEditMode ? 'Actualizar Cliente' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  );
}
