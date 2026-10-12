import { useEffect, useState } from 'react'
import { Printer, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { globalToast } from '../components/Layout'

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
  const [busqueda, setBusqueda] = useState('')

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

  const sortedGroups = Object.entries(grouped)
    .sort(([, a]: any, [, b]: any) => (a.cliente?.orden_ruta || 999) - (b.cliente?.orden_ruta || 999))
    .filter(([, { cliente }]: any) => {
      if (!busqueda.trim()) return true
      const q = busqueda.toLowerCase()
      return cliente?.nombre?.toLowerCase().includes(q) ||
        String(cliente?.codigo)?.includes(q) ||
        cliente?.poblacion?.toLowerCase().includes(q)
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
    for (const [id, grupo] of sortedGroups) {
      const cliente = (grupo as any).cliente
      if (!cliente?.telefono1) continue
      whatsappCliente(id)
      await new Promise(r => setTimeout(r, 800))
    }
    setEnviando(false)
  }

  // Exportar pedidos del día como Excel
  const exportarExcel = async () => {
    globalToast('⏳ Generando Excel...')
    try {
      if (!(window as any).XLSX) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
          s.onload = () => resolve(); s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const XLSX = (window as any).XLSX
      const wb = XLSX.utils.book_new()
      // Hoja 1: Resumen por cliente
      const resumenRows = sortedGroups.map(([, { cliente, items }]: any) => ({
        'Cliente': cliente?.nombre || '—',
        'Dirección': cliente?.direccion || '—',
        'Zona': cliente?.poblacion || '—',
        'Unidades': items.reduce((s: number, p: any) => s + Number(p.cantidad), 0),
        'Total (€)': items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0).toFixed(2),
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen clientes')
      // Hoja 2: Detalle por producto
      const detalleRows: any[] = []
      sortedGroups.forEach(([, { cliente, items }]: any) => {
        items.forEach((p: any) => {
          detalleRows.push({
            'Cliente': cliente?.nombre || '—',
            'Producto': p.productos?.nombre || '—',
            'Cantidad': Number(p.cantidad),
            'Precio unit.': Number(p.precio).toFixed(4),
            'IVA %': p.iva,
            'Total (€)': (Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100)).toFixed(2),
          })
        })
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleRows), 'Detalle productos')
      // Hoja 3: Totales por producto
      const prodMap: Record<string, number> = {}
      pedidos.forEach((p: any) => {
        const n = p.productos?.nombre || '—'
        prodMap[n] = (prodMap[n] || 0) + Number(p.cantidad)
      })
      const prodRows = Object.entries(prodMap).sort(([,a],[,b]) => b-a).map(([nombre, uds]) => ({ 'Producto': nombre, 'Total unidades': uds }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Total por producto')
      XLSX.writeFile(wb, 'Pedidos_' + fecha + '.xlsx')
      globalToast('✅ Excel descargado')
    } catch(err: any) { globalToast('Error: ' + err.message, 'error') }
  }

  // Construir HTML para PDF/JPG
  const buildPedidosHTML = () => {
    const prodMap: Record<string, number> = {}
    pedidos.forEach((p: any) => {
      const n = p.productos?.nombre || '—'
      prodMap[n] = (prodMap[n] || 0) + Number(p.cantidad)
    })
    const totalUds = pedidos.reduce((s, p) => s + Number(p.cantidad), 0)
    const totalEur = pedidos.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
    const filas = sortedGroups.map(([, { cliente, items }]: any) => {
      const uds = items.reduce((s: number, p: any) => s + Number(p.cantidad), 0)
      const eur = items.reduce((s: number, p: any) => s + Number(p.cantidad) * Number(p.precio) * (1 + Number(p.iva) / 100), 0)
      return `<tr>
        <td><strong>${cliente?.nombre || '—'}</strong><br><small>${cliente?.direccion || ''}</small></td>
        <td>${items.map((p: any) => `${p.productos?.nombre}: <strong>${p.cantidad}</strong>`).join('<br>')}</td>
        <td style="text-align:right"><strong>${uds}</strong></td>
        <td style="text-align:right"><strong>${eur.toFixed(2)} €</strong></td>
      </tr>`
    }).join('')
    const prodFilas = Object.entries(prodMap).sort(([,a],[,b])=>b-a)
      .map(([n,u]) => `<tr><td>${n}</td><td style="text-align:right"><strong>${u} ud</strong></td></tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Pedidos ${fecha}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:28px 36px;color:#1a1a1a;font-size:11.5px}
      h1{color:#E8670A;font-size:1.3rem;margin-bottom:2px}
      .sub{color:#888;font-size:0.78rem;margin-bottom:14px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:0.82rem}
      th{background:#E8670A;color:white;padding:6px 9px;text-align:left;font-size:0.68rem;text-transform:uppercase}
      td{padding:6px 9px;border-bottom:1px solid #f5e0c5;vertical-align:top}
      tfoot tr{background:#5a2d0c;color:white;font-weight:900}
      tfoot td{border:none;padding:8px 9px}
      .kpi{border:1.5px solid #f5e8d8;border-radius:8px;padding:8px 12px;text-align:center;display:inline-block;margin-right:10px}
      .kv{font-size:1.1rem;font-weight:900;color:#E8670A}
      .kl{font-size:0.65rem;color:#888;text-transform:uppercase}
      @media print{body{padding:16px 22px}}
    </style></head><body>
    <h1>📋 Pedidos del día — ${fecha}</h1>
    <div class="sub">TelePan Henares · ${new Date().toLocaleDateString('es-ES')}</div>
    <div style="margin-bottom:14px">
      <div class="kpi"><div class="kv">${sortedGroups.length}</div><div class="kl">Clientes</div></div>
      <div class="kpi"><div class="kv">${totalUds}</div><div class="kl">Unidades</div></div>
      <div class="kpi"><div class="kv">${totalEur.toFixed(2)} €</div><div class="kl">Total</div></div>
    </div>
    <div class="grid">
      <div>
        <table>
          <thead><tr><th>Cliente</th><th>Productos</th><th>Uds</th><th>Total</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr><td colspan="2">TOTAL</td><td style="text-align:right">${totalUds}</td><td style="text-align:right">${totalEur.toFixed(2)} €</td></tr></tfoot>
        </table>
      </div>
      <div>
        <table>
          <thead><tr><th>Producto</th><th>Total uds</th></tr></thead>
          <tbody>${prodFilas}</tbody>
        </table>
      </div>
    </div>
    </body></html>`
  }

  const exportarPDF = () => {
    const html = buildPedidosHTML()
    const w = window.open('', '_blank')
    if (!w) return globalToast('Permite las ventanas emergentes', 'error')
    w.document.write(html); w.document.close()
    globalToast('💡 Abre el menú del navegador → Imprimir → Guardar como PDF')
  }

  const exportarJPG = async () => {
    globalToast('⏳ Generando imagen...')
    try {
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
          s.onload = () => resolve(); s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const h2c = (window as any).html2canvas
      const html = buildPedidosHTML()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1000px;height:1400px;border:none'
      document.body.appendChild(iframe)
      await new Promise<void>(resolve => { iframe.onload = () => resolve(); iframe.src = blobUrl })
      if (iframe.contentWindow) (iframe.contentWindow as any).print = () => {}
      await new Promise(r => setTimeout(r, 1200))
      const canvas = await h2c(iframe.contentDocument!.body, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: 1000
      })
      document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/jpeg', 0.95)
      a.download = 'Pedidos_' + fecha + '.jpg'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      globalToast('✅ JPG descargado')
    } catch(err: any) { globalToast('Error: ' + err.message, 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📄 Albaranes</h1>
        <div className="page-actions">
          <input type="date" className="input" style={{ width: 'auto' }} value={fecha} onChange={e => setFecha(e.target.value)} />
          {sortedGroups.length > 0 && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={exportarExcel} title="Descargar Excel">📊 Excel</button>
              <button className="btn btn-secondary btn-sm" onClick={exportarPDF} title="Descargar PDF">⬇️ PDF</button>
              <button className="btn btn-secondary btn-sm" onClick={exportarJPG} title="Descargar JPG">📷 JPG</button>
              <button className="btn btn-secondary" onClick={printTodos}>
                <Printer size={16} /> Imprimir
              </button>
              <button className="btn btn-success" onClick={whatsappTodos} disabled={enviando}
                style={{ background: '#25D366', border: 'none' }}>
                <MessageCircle size={16} />
                {enviando ? 'Enviando...' : `📱 WhatsApp (${sortedGroups.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* RESUMEN DEL DÍA */}
      {sortedGroups.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Clientes', value: sortedGroups.length, color: 'var(--naranja)' },
            { label: 'Unidades', value: pedidos.reduce((s,p)=>s+Number(p.cantidad),0), color: '#2563eb' },
            { label: 'Total €', value: pedidos.reduce((s,p)=>s+Number(p.cantidad)*Number(p.precio)*(1+Number(p.iva)/100),0).toFixed(2)+' €', color: '#16a34a' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem', color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--gris)', fontWeight: 800, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gris)' }}>🔍</span>
        <input className="input" placeholder="Buscar cliente..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)} style={{ paddingLeft: 34 }} />
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
