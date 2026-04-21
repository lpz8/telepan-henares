import { useEffect, useState } from 'react'
import { Printer, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EMISOR = {
  nombre: 'Yeny Rubi Ruiz Carvajal',
  direccion: 'Calle Valdecanillas 59 3A',
  cp_ciudad: '28037 Madrid',
  nie: 'Z1806715R',
  iban: 'ES9420858284100330219325',
  bizum: '622334126',
}

export default function Albaranes() {
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(today)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase
      .from('pedidos')
      .select('*, clientes(nombre, direccion, codigo_postal, poblacion, codigo, orden_ruta, telefono1), productos(nombre)')
      .eq('fecha', fecha)
      .order('created_at')
      .then(({ data }) => { if (data) setPedidos(data) })
  }, [fecha])

  const grouped = pedidos.reduce((acc: Record<string, any>, p) => {
    const id = p.cliente_id
    if (!acc[id]) acc[id] = { cliente: p.clientes, items: [] }
    acc[id].items.push(p)
    return acc
  }, {})

  const sortedGroups = Object.entries(grouped).sort(([, a]: any, [, b]: any) => {
    const ca = parseInt(a.cliente?.codigo || '9999')
    const cb = parseInt(b.cliente?.codigo || '9999')
    return ca - cb
  })

  const buildAlbaranHTML = (clienteId: string) => {
    const { cliente, items } = grouped[clienteId]
    const total = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
    return `<!DOCTYPE html>
      <html><head>
        <meta charset="UTF-8">
        <title>Albarán - ${cliente?.nombre}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap');
          * { box-sizing: border-box; }
          body { font-family: 'Nunito', sans-serif; padding: 30px; max-width: 700px; margin: 0 auto; color: #1a1a1a; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #E8670A; padding-bottom: 16px; margin-bottom: 20px; }
          .emisor { font-size: 0.8rem; text-align: right; }
          .emisor strong { font-size: 0.95rem; color: #5a2d0c; display: block; margin-bottom: 4px; }
          .titulo { font-size: 1.3rem; font-weight: 800; color: #E8670A; margin-bottom: 4px; }
          .cliente-box { background: #fff8f0; border: 1px solid #f5e8d8; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #E8670A; color: white; padding: 8px 10px; text-align: left; font-size: 0.8rem; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #f5e0c5; font-size: 0.875rem; }
          .total-row td { font-weight: 800; background: #fff3e8; border-top: 2px solid #E8670A; }
          .footer { margin-top: 24px; font-size: 0.8rem; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
          @media print { button { display: none; } }
        </style>
      </head><body>
        <div class="header">
          <div>
            <div class="titulo">TELEPAN HENARES</div>
            <div style="font-size:0.8rem;color:#888">"La panadería en casa"</div>
          </div>
          <div class="emisor">
            <strong>${EMISOR.nombre}</strong>
            ${EMISOR.direccion}<br>${EMISOR.cp_ciudad}<br>NIE: ${EMISOR.nie}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <div><strong style="font-size:1.1rem">Albarán</strong><br>
            <span style="color:#888;font-size:0.85rem">Fecha: ${fecha}</span>
          </div>
        </div>
        <div class="cliente-box">
          <strong>Cliente #${cliente?.codigo}: ${cliente?.nombre}</strong><br>
          <span style="font-size:0.85rem;color:#666">${cliente?.direccion || ''} — ${cliente?.poblacion || ''}</span>
        </div>
        <table>
          <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
          ${items.map((p: any) => `
            <tr>
              <td>${p.productos?.nombre}</td>
              <td>${p.cantidad}</td>
              <td>${Number(p.precio).toFixed(2)} €</td>
              <td>${(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)} €</td>
            </tr>
          `).join('')}
          <tr class="total-row"><td colspan="3">TOTAL</td><td>${total.toFixed(2)} €</td></tr>
        </table>
        <div class="footer">
          Bizum: ${EMISOR.bizum} · IBAN: ${EMISOR.iban}
        </div>
        <script>window.onload=()=>window.print()</script>
      </body></html>`
  }

  const printAlbaran = (clienteId: string) => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildAlbaranHTML(clienteId))
    w.document.close()
  }

  const printTodos = () => sortedGroups.forEach(([id]) => printAlbaran(id))

  // WhatsApp a UN cliente
  const whatsappCliente = (clienteId: string) => {
    const { cliente, items } = grouped[clienteId]
    const tel = (cliente?.telefono1 || '').replace(/\D/g, '')
    if (!tel) { alert(`${cliente?.nombre} no tiene teléfono registrado`); return }
    const total = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
    const lineas = items.map((p: any) =>
      `• ${p.productos?.nombre}: ${p.cantidad} ud — ${(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)}€`
    ).join('\n')
    const msg = encodeURIComponent(
      `Hola ${cliente?.nombre}, su pedido de hoy ${fecha}:\n\n${lineas}\n\nTotal: ${total.toFixed(2)}€\n\nGracias, TelePan Henares 🍞`
    )
    window.open(`https://wa.me/34${tel}?text=${msg}`, '_blank')
  }

  // WhatsApp a TODOS los clientes
  const whatsappTodos = async () => {
    const sinTelefono = sortedGroups.filter(([, { cliente }]: any) => !cliente?.telefono1)
    if (sinTelefono.length > 0) {
      const nombres = sinTelefono.map(([, { cliente }]: any) => cliente?.nombre).join(', ')
      if (!confirm(`${sinTelefono.length} clientes sin teléfono se saltarán: ${nombres}\n\n¿Continuar con los demás?`)) return
    }
    setEnviando(true)
    for (const [id, group] of sortedGroups) {
      const { cliente } = group as any
      if (!cliente?.telefono1) continue
      whatsappCliente(id)
      await new Promise(r => setTimeout(r, 800))
    }
    setEnviando(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📄 Albaranes</h1>
        <div className="page-actions">
          <input type="date" className="input" style={{ width: 'auto' }} value={fecha} onChange={e => setFecha(e.target.value)} />
          {sortedGroups.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={printTodos}>
                <Printer size={16} /> Imprimir todos
              </button>
              <button className="btn btn-success" onClick={whatsappTodos} disabled={enviando}
                style={{ background: '#25D366', border: 'none' }}>
                <MessageCircle size={16} />
                {enviando ? 'Enviando...' : `📱 WhatsApp a todos (${sortedGroups.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {sortedGroups.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: '0.85rem', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📋 <strong>{sortedGroups.length} clientes</strong> con pedido el {fecha}</span>
          <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)' }}>
            Total: {sortedGroups.reduce((s, [, { items }]: any) =>
              s + items.reduce((ss: number, p: any) => ss + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0), 0
            ).toFixed(2)} €
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedGroups.map(([clienteId, { cliente, items }]: any) => {
          const total = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
          const tieneTel = !!cliente?.telefono1
          return (
            <div key={clienteId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontFamily: 'Fredoka One', color: 'var(--naranja)', marginRight: 8 }}>#{cliente?.codigo}</span>
                  <strong>{cliente?.nombre}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gris)', marginTop: 2 }}>
                    {cliente?.direccion} — {cliente?.poblacion}
                    {cliente?.telefono1 && <> · 📞 {cliente.telefono1}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => printAlbaran(clienteId)}>
                    <Printer size={14} /> PDF
                  </button>
                  <button
                    style={{ background: tieneTel ? '#25D366' : '#ccc', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem', fontWeight: 800, cursor: tieneTel ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => tieneTel && whatsappCliente(clienteId)}
                    title={tieneTel ? 'Enviar por WhatsApp' : 'Sin teléfono registrado'}>
                    📱 WA
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
                  <tbody>
                    {items.map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.productos?.nombre}</td>
                        <td>{p.cantidad}</td>
                        <td>{Number(p.precio).toFixed(2)} €</td>
                        <td><strong>{(Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2)} €</strong></td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--crema-dark)' }}>
                      <td colSpan={3}><strong>TOTAL</strong></td>
                      <td><strong style={{ color: 'var(--naranja)' }}>{total.toFixed(2)} €</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
        {sortedGroups.length === 0 && (
          <div className="card"><div className="empty-state"><p>No hay albaranes para esta fecha</p></div></div>
        )}
      </div>
    </div>
  )
}