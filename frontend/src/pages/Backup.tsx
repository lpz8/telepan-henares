import { useState } from 'react'
import { Download, Upload, Shield, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { globalToast } from '../components/Layout'

export default function Backup() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [exportandoPDF, setExportandoPDF] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('last_backup'))

  const exportBackup = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [clientes, productos, pedidos, pedidos_modelo, facturas, lineas, gastos, proveedores, config, susps] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('productos').select('*'),
        supabase.from('pedidos').select('*'),
        supabase.from('pedidos_modelo').select('*'),
        supabase.from('facturas').select('*'),
        supabase.from('lineas_factura').select('*'),
        supabase.from('gastos').select('*'),
        supabase.from('proveedores').select('*'),
        supabase.from('configuracion').select('*'),
        supabase.from('suspensiones_pedido').select('*'),
      ])
      const backup = {
        version: '2.0', fecha: new Date().toISOString(), user_id: user.id,
        datos: {
          clientes: clientes.data||[], productos: productos.data||[], pedidos: pedidos.data||[],
          pedidos_modelo: pedidos_modelo.data||[], facturas: facturas.data||[],
          lineas_factura: lineas.data||[], gastos: gastos.data||[],
          proveedores: proveedores.data||[], configuracion: config.data||[],
          suspensiones_pedido: susps.data||[],
        },
        resumen: { clientes: clientes.data?.length||0, productos: productos.data?.length||0, pedidos: pedidos.data?.length||0, facturas: facturas.data?.length||0, gastos: gastos.data?.length||0 }
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `telepan-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click(); URL.revokeObjectURL(a.href)
      const fecha = new Date().toLocaleString('es-ES')
      localStorage.setItem('last_backup', fecha); setLastBackup(fecha)
      globalToast('✅ Backup descargado correctamente')
    } catch (err: any) { globalToast(err.message, 'error') }
    setLoading(false)
  }

  const exportarExcel = async () => {
    if (!user) return
    setExportandoExcel(true)
    try {
      const [clientes, pedidos, facturas, gastos] = await Promise.all([
        supabase.from('clientes').select('codigo, nombre, direccion, codigo_postal, poblacion, provincia, telefono1, telefono2, forma_pago, observaciones').order('codigo'),
        supabase.from('pedidos').select('fecha, cantidad, precio, iva, clientes(nombre), productos(nombre)').order('fecha', { ascending: false }).limit(1000),
        supabase.from('facturas').select('numero, fecha, mes, tipo_pago, base, iva_total, total, pagado, fecha_pago, clientes(nombre)').order('numero'),
        supabase.from('gastos').select('fecha, concepto, categoria, importe').order('fecha', { ascending: false }),
      ])
      const BOM = '\uFEFF'
      const csv = (cab: string[], filas: any[][]) =>
        [cab, ...filas].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n')

      const fecha = new Date().toISOString().split('T')[0]
      const archivos = [
        { nombre: `telepan-clientes-${fecha}.csv`, contenido: BOM + csv(
          ['Código','Nombre','Dirección','CP','Población','Provincia','Tel1','Tel2','Forma Pago','Observaciones'],
          (clientes.data||[]).map(c => [c.codigo,c.nombre,c.direccion,c.codigo_postal,c.poblacion,c.provincia,c.telefono1,c.telefono2,c.forma_pago,c.observaciones])
        )},
        { nombre: `telepan-pedidos-${fecha}.csv`, contenido: BOM + csv(
          ['Fecha','Cliente','Producto','Cantidad','Precio s/IVA','IVA%','Total'],
          (pedidos.data||[]).map((p:any) => [p.fecha,p.clientes?.nombre||'',p.productos?.nombre||'',p.cantidad,Number(p.precio).toFixed(2),p.iva,(Number(p.cantidad)*Number(p.precio)*(1+Number(p.iva)/100)).toFixed(2)])
        )},
        { nombre: `telepan-facturas-${fecha}.csv`, contenido: BOM + csv(
          ['Número','Cliente','Fecha','Mes','Forma Pago','Base','IVA','Total','Pagado','Fecha Pago'],
          (facturas.data||[]).map((f:any) => [f.numero,f.clientes?.nombre||'',f.fecha,f.mes,f.tipo_pago,Number(f.base).toFixed(2),Number(f.iva_total).toFixed(2),Number(f.total).toFixed(2),f.pagado?'Sí':'No',f.fecha_pago||''])
        )},
        { nombre: `telepan-gastos-${fecha}.csv`, contenido: BOM + csv(
          ['Fecha','Concepto','Categoría','Importe'],
          (gastos.data||[]).map(g => [g.fecha,g.concepto,g.categoria,Number(g.importe).toFixed(2)])
        )},
      ]
      for (const archivo of archivos) {
        const blob = new Blob([archivo.contenido], { type: 'text/csv;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = archivo.nombre; a.click(); URL.revokeObjectURL(a.href)
        await new Promise(r => setTimeout(r, 300))
      }
      globalToast('✅ 4 archivos CSV descargados')
    } catch (err: any) { globalToast(err.message, 'error') }
    setExportandoExcel(false)
  }

     const exportarWhatsApp = async () => {
  if (!user) return
  setLoading(true)
  try {
    const { data: clientes } = await supabase
      .from('clientes')
      .select('nombre, telefono1, telefono2, poblacion, direccion')
      .order('nombre')

    if (!clientes?.length) { globalToast('No hay clientes', 'error'); setLoading(false); return }

    const vcf = (clientes || []).map(c => {
      const tel1 = (c.telefono1 || '').replace(/\D/g, '')
      const tel2 = (c.telefono2 || '').replace(/\D/g, '')
      let card = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.nombre}\nN:${c.nombre};;;;\nORG:Cliente TelePan\nADR:;;${c.direccion || ''};${c.poblacion || ''};;;\n`
      if (tel1) card += `TEL;TYPE=CELL:+34${tel1}\n`
      if (tel2) card += `TEL;TYPE=WORK:+34${tel2}\n`
      card += `NOTE:Cliente TelePan Henares - ${c.poblacion || ''}\nEND:VCARD`
      return card
    }).join('\n\n')

    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `contactos-telepan-${new Date().toISOString().split('T')[0]}.vcf`
    a.click()
    URL.revokeObjectURL(a.href)
    globalToast(`✅ ${clientes.length} contactos exportados — importa el archivo en tu móvil`)
  } catch (err: any) { globalToast(err.message, 'error') }
  setLoading(false)
}

  const exportarPDF = async () => {
    if (!user) return
    setExportandoPDF(true)
    try {
      const [clientes, facturas, gastos] = await Promise.all([
        supabase.from('clientes').select('codigo, nombre, direccion, poblacion, telefono1, forma_pago').order('codigo'),
        supabase.from('facturas').select('numero, fecha, tipo_pago, base, iva_total, total, pagado, clientes(nombre)').order('numero'),
        supabase.from('gastos').select('fecha, concepto, categoria, importe').order('fecha', { ascending: false }),
      ])
      const estilos = `<style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:12px}
        h1{color:#E8670A;font-size:18px;margin-bottom:4px}
        p{color:#888;font-size:11px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th{background:#E8670A;color:white;padding:7px 9px;text-align:left;font-size:11px}
        td{padding:5px 9px;border-bottom:1px solid #f5e0c5;font-size:11px}
        tr:nth-child(even){background:#fff8f0}
        .ok{color:#16a34a;font-weight:bold}
        .no{color:#dc2626;font-weight:bold}
        .tot{color:#E8670A;font-weight:bold}
        @media print{body{padding:10px}}
      </style>`
      const hoy = new Date().toLocaleDateString('es-ES')
      const totFact = (facturas.data||[]).reduce((s,f)=>s+Number(f.total),0)
      const totCob = (facturas.data||[]).filter(f=>f.pagado).reduce((s,f)=>s+Number(f.total),0)
      const totGast = (gastos.data||[]).reduce((s,g)=>s+Number(g.importe),0)

      const pdfs = [
        { html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Clientes</title>${estilos}</head><body>
          <h1>🍞 TelePan Henares — Clientes</h1>
          <p>Exportado el ${hoy} · ${clientes.data?.length||0} clientes</p>
          <table><thead><tr><th>Cód.</th><th>Nombre</th><th>Dirección</th><th>Zona</th><th>Teléfono</th><th>Forma pago</th></tr></thead><tbody>
          ${(clientes.data||[]).map(c=>`<tr><td>${c.codigo||''}</td><td><strong>${c.nombre||''}</strong></td><td>${c.direccion||''}</td><td>${c.poblacion||''}</td><td>${c.telefono1||''}</td><td>${c.forma_pago||''}</td></tr>`).join('')}
          </tbody></table><script>window.onload=()=>window.print()</script></body></html>` },
        { html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facturas</title>${estilos}</head><body>
          <h1>🍞 TelePan Henares — Facturas</h1>
          <p>Exportado el ${hoy} · ${facturas.data?.length||0} facturas · Facturado: <strong>${totFact.toFixed(2)}€</strong> · Cobrado: <strong>${totCob.toFixed(2)}€</strong></p>
          <table><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Tipo pago</th><th>Base</th><th>IVA</th><th>Total</th><th>Pagado</th></tr></thead><tbody>
          ${(facturas.data||[]).map((f:any)=>`<tr><td><strong>${f.numero}</strong></td><td>${f.clientes?.nombre||''}</td><td>${f.fecha||''}</td><td>${f.tipo_pago||''}</td><td>${Number(f.base).toFixed(2)}€</td><td>${Number(f.iva_total).toFixed(2)}€</td><td class="tot">${Number(f.total).toFixed(2)}€</td><td class="${f.pagado?'ok':'no'}">${f.pagado?'✅ Sí':'❌ No'}</td></tr>`).join('')}
          </tbody></table><script>window.onload=()=>window.print()</script></body></html>` },
        { html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gastos</title>${estilos}</head><body>
          <h1>🍞 TelePan Henares — Gastos</h1>
          <p>Exportado el ${hoy} · ${gastos.data?.length||0} gastos · Total: <strong>${totGast.toFixed(2)}€</strong></p>
          <table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Importe</th></tr></thead><tbody>
          ${(gastos.data||[]).map(g=>`<tr><td>${g.fecha||''}</td><td><strong>${g.concepto||''}</strong></td><td>${g.categoria||''}</td><td class="tot">${Number(g.importe).toFixed(2)}€</td></tr>`).join('')}
          </tbody></table><script>window.onload=()=>window.print()</script></body></html>` },
      ]
      for (const pdf of pdfs) {
        const w = window.open('','_blank')
        if (w) { w.document.write(pdf.html); w.document.close() }
        await new Promise(r => setTimeout(r, 500))
      }
      globalToast('✅ 3 PDFs abiertos — en cada uno pulsa Ctrl+P → Guardar como PDF')
    } catch (err: any) { globalToast(err.message, 'error') }
    setExportandoPDF(false)
  }

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!confirm('⚠️ Esto REEMPLAZARÁ todos los datos actuales. ¿Continuar?')) return
    setRestoring(true)
    try {
      const backup = JSON.parse(await file.text())
      if (!backup.datos) throw new Error('Archivo de backup no válido')
      const { datos } = backup
      const tablas = ['clientes','productos','pedidos_modelo','pedidos','gastos','proveedores']
      for (const tabla of tablas) {
        if (datos[tabla]?.length) {
          await supabase.from(tabla).delete().eq('user_id', user.id)
          await supabase.from(tabla).insert(datos[tabla].map((x:any) => ({ ...x, user_id: user.id })))
        }
      }
      globalToast('✅ Backup restaurado correctamente')
      e.target.value = ''
    } catch (err: any) { globalToast('Error al restaurar: ' + err.message, 'error') }
    setRestoring(false)
  }

  const stats = [
    { label: 'Clientes', icon: '👥' }, { label: 'Productos', icon: '📦' },
    { label: 'Pedidos', icon: '🛒' }, { label: 'Facturas', icon: '🧾' },
    { label: 'Gastos', icon: '💸' }, { label: 'Pedidos habituales', icon: '📋' },
    { label: 'Proveedores', icon: '🚚' }, { label: 'Configuración', icon: '⚙️' },
  ]

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1 className="page-title">🔒 Copias de Seguridad</h1>
      </div>

      <div className="card" style={{ marginBottom: 16, background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={24} color="#16a34a" />
          <h3 style={{ fontFamily: 'Fredoka One', color: '#16a34a', fontSize: '1.1rem' }}>Tus datos están seguros</h3>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#166534' }}>
          Todos tus datos se guardan en Supabase (la nube). El backup descarga una copia adicional en tu dispositivo.
          {lastBackup && <><br /><strong>Último backup: {lastBackup}</strong></>}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 12 }}>📦 El backup incluye</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--crema)', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700 }}>
              <span>{s.icon}</span> {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 8 }}>⬇️ Exportar backup completo</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--gris)', marginBottom: 14 }}>
          Descarga todos tus datos en un archivo JSON para restaurarlos si es necesario.
        </p>
        <button className="btn btn-primary" onClick={exportBackup} disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
          <Download size={18} /> {loading ? 'Exportando...' : 'Descargar backup completo (JSON)'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, border: '1.5px solid #bbf7d0', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FileSpreadsheet size={22} color="#16a34a" />
          <h3 style={{ fontFamily: 'Fredoka One', color: '#16a34a', fontSize: '1rem' }}>📊 Exportar para el gestor</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#166534', marginBottom: 14 }}>
          Descarga tus datos en <strong>Excel (CSV)</strong> o en <strong>PDF</strong> para llevar al gestor o archivar.
        </p>
        <button className="btn btn-success" onClick={exportarExcel} disabled={exportandoExcel}
          style={{ width: '100%', justifyContent: 'center', padding: 12, marginBottom: 8 }}>
          <FileSpreadsheet size={18} />
          {exportandoExcel ? 'Generando Excel...' : '📊 Descargar en Excel — 4 archivos CSV'}
        </button>
        <button className="btn btn-primary" onClick={exportarPDF} disabled={exportandoPDF}
          style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
          <Download size={18} />
          {exportandoPDF ? 'Generando PDFs...' : '📄 Descargar en PDF — 3 archivos (Clientes, Facturas, Gastos)'}
        </button>
        <div className="card" style={{ marginBottom: 16, border: '1.5px solid #dcfce7', background: '#f0fdf4' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: '1.3rem' }}>📱</span>
    <h3 style={{ fontFamily: 'Fredoka One', color: '#16a34a', fontSize: '1rem' }}>Exportar contactos a WhatsApp</h3>
  </div>
  <p style={{ fontSize: '0.85rem', color: '#166534', marginBottom: 14 }}>
    Descarga todos tus clientes como contactos del móvil. Impórtalos y WhatsApp los reconocerá automáticamente.
  </p>
  <button className="btn btn-success" onClick={exportarWhatsApp} disabled={loading}
    style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
    📱 {loading ? 'Exportando...' : 'Descargar contactos (.vcf)'}
  </button>
  <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#166534' }}>
    <strong>iPhone:</strong> Abre el archivo .vcf → "Añadir todos los contactos"<br />
    <strong>Android:</strong> Abre el archivo .vcf → "Importar" en Contactos<br />
    <strong>WhatsApp</strong> los detectará automáticamente al sincronizar
  </div>
</div>
        <p style={{ fontSize: '0.75rem', color: '#166534', marginTop: 10, textAlign: 'center' }}>
          💡 Para PDF: se abren 3 ventanas · en cada una pulsa <strong>Ctrl+P → Guardar como PDF</strong>
        </p>
      </div>

      <div className="card" style={{ border: '1.5px solid #fecaca', background: '#fef2f2', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={20} color="#dc2626" />
          <h3 style={{ fontFamily: 'Fredoka One', color: '#dc2626', fontSize: '1rem' }}>⬆️ Restaurar backup</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#991b1b', marginBottom: 14 }}>
          ⚠️ Esto reemplazará TODOS los datos actuales. Usa solo si has perdido datos.
        </p>
        <input type="file" accept=".json" onChange={importBackup} style={{ display: 'none' }} id="restore-input" />
        <button className="btn btn-danger" disabled={restoring}
          style={{ width: '100%', justifyContent: 'center', padding: 12 }}
          onClick={() => document.getElementById('restore-input')?.click()}>
          <Upload size={18} /> {restoring ? 'Restaurando...' : 'Seleccionar archivo de backup'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: 'Fredoka One', color: 'var(--marron)', marginBottom: 10 }}>📱 Usar en iPhone y Android</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--gris)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--marron)', display: 'block', marginBottom: 6 }}>iPhone (Safari):</strong>
          1. Abre la app en Safari → 2. Pulsa compartir (↑) → 3. "Añadir a pantalla de inicio"
          <br /><br />
          <strong style={{ color: 'var(--marron)', display: 'block', marginBottom: 6 }}>Android (Chrome):</strong>
          1. Abre en Chrome → 2. Menú (3 puntos) → 3. "Instalar aplicación"
          <br /><br />
          <strong style={{ color: 'var(--naranja)' }}>💡 Para acceder desde cualquier lugar</strong>, publica la app gratis en{' '}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--naranja)' }}>vercel.com</a>
        </div>
      </div>
    </div>
  )
}
