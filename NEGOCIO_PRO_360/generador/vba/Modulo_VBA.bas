Attribute VB_Name = "NP360"
'==============================================================================
'  NEGOCIO PRO 360 ENTERPRISE  -  Módulo de automatización (VBA)
'  Versión 1.0.0
'
'  Contenido:
'   1. Utilidades (tablas, nombres, protección, transacciones, log)
'   2. Registrar ventas / compras / recepción / gastos / pagos y abonos
'   3. Ajustes de inventario, otros movimientos de caja, cierre de caja, anulaciones
'   4. Consultas (producto, cliente), Kardex, pedidos de reposición
'   5. Dashboard, informes, exportación PDF / Excel
'   6. Limpiar formularios, copias de seguridad, validación y detección de errores
'   7. Navegación, botones, protección, autoprueba de macros, mantenimiento
'
'  Principios:
'   * Las macros SOLO agregan filas a las tablas; el inventario, la cartera y la
'     caja se recalculan con fórmulas a partir de esas filas (no hay doble conteo).
'   * Cada registro es una "transacción": si algo falla a mitad de camino se
'     eliminan las filas agregadas y los datos históricos quedan intactos.
'   * Limpiar un formulario borra solo las celdas de captura, nunca el historial.
'   * Toda operación queda en la hoja LOG con fecha, hora y usuario.
'==============================================================================
Option Explicit

Private Const APP As String = "NEGOCIO PRO 360"
Private Const HOJAS_PROTEGIDAS As String = "INICIO,DASHBOARD,INVENTARIO,KARDEX,REPOSICION,ROTACION,CAJA,CARTERA,EQUILIBRIO,INFORMES,ANALISIS,LOGISTICA,VALIDACION,PRUEBAS,F_VENTA,F_COMPRA,F_MOVIMIENTOS,F_CONSULTA"

Private mTx As Collection        ' filas agregadas en la transacción actual ("tabla|fila")
Private mSilencio As Boolean     ' True durante la autoprueba: no muestra mensajes
Private mUltimoDoc As String     ' último documento registrado (para la autoprueba)

'==============================================================================
' 1. UTILIDADES
'==============================================================================

' Devuelve la tabla (ListObject) con el nombre indicado, esté en la hoja que esté.
Public Function T(ByVal nombreTabla As String) As ListObject
    Dim ws As Worksheet, lo As ListObject
    For Each ws In ThisWorkbook.Worksheets
        For Each lo In ws.ListObjects
            If StrComp(lo.Name, nombreTabla, vbTextCompare) = 0 Then
                Set T = lo
                Exit Function
            End If
        Next lo
    Next ws
    Fallo "No se encontró la tabla '" & nombreTabla & "'. No cambie los nombres de las tablas."
End Function

' Rango de un nombre definido (celdas de formularios y parámetros).
Public Function R(ByVal nombre As String) As Range
    On Error GoTo NoExiste
    Set R = ThisWorkbook.Names(nombre).RefersToRange
    Exit Function
NoExiste:
    Fallo "No se encontró el nombre definido '" & nombre & "'."
End Function

Private Function V(ByVal nombre As String) As Variant
    V = R(nombre).Cells(1, 1).Value
End Function

Private Function Hoja(ByVal nombre As String) As Worksheet
    On Error GoTo NoExiste
    Set Hoja = ThisWorkbook.Worksheets(nombre)
    Exit Function
NoExiste:
    Fallo "No existe la hoja '" & nombre & "'."
End Function

' Lanza un error controlado con un mensaje para el usuario.
Private Sub Fallo(ByVal mensaje As String)
    Err.Raise vbObjectError + 513, APP, mensaje
End Sub

Private Function Txt(ByVal dato As Variant) As String
    If IsError(dato) Then Exit Function
    If IsEmpty(dato) Or IsNull(dato) Then Exit Function
    Txt = Trim$(CStr(dato))
End Function

Private Function Num(ByVal dato As Variant) As Double
    If IsError(dato) Then Exit Function
    If IsEmpty(dato) Or IsNull(dato) Then Exit Function
    If VarType(dato) = vbBoolean Then Exit Function
    If IsNumeric(dato) Then Num = CDbl(dato)
End Function

Private Function EsVacio(ByVal dato As Variant) As Boolean
    EsVacio = (Txt(dato) = "")
End Function

Private Function Usuario() As String
    Usuario = Application.UserName
    If Usuario = "" Then Usuario = Environ$("USERNAME")
End Function

Private Function Moneda(ByVal x As Double) As String
    Moneda = "$ " & Format$(x, "#,##0")
End Function

Private Function Clave() As String
    On Error Resume Next
    Clave = Txt(V("cfg_Clave"))
    If Clave = "" Then Clave = "NP360"
End Function

Private Sub Aviso(ByVal mensaje As String, Optional ByVal icono As Long = 64)   ' 64 = vbInformation
    If Not mSilencio Then MsgBox mensaje, icono, APP
End Sub

Private Function Confirmar(ByVal mensaje As String) As Boolean
    If mSilencio Then
        Confirmar = True
    Else
        Confirmar = (MsgBox(mensaje, vbYesNo + vbQuestion, APP) = vbYes)
    End If
End Function

' Fecha de una celda de formulario: vacía = hoy.
Private Function FechaDe(ByVal nombre As String) As Date
    Dim x As Variant
    x = V(nombre)
    If EsVacio(x) Then
        FechaDe = Date
    ElseIf IsDate(x) Then
        FechaDe = CDate(x)
    Else
        Fallo "La fecha ingresada no es válida (use DD/MM/AAAA)."
    End If
End Function

' Fila (1..n) donde la columna 'col' de la tabla es igual a 'valor'. 0 si no existe.
Private Function FilaDe(lo As ListObject, ByVal col As String, ByVal valor As Variant) As Long
    Dim i As Long, arr As Variant, s As String
    If lo.ListRows.Count = 0 Then Exit Function
    arr = lo.ListColumns(col).DataBodyRange.Value
    s = UCase$(Txt(valor))
    If s = "" Then Exit Function
    If lo.ListRows.Count = 1 Then
        If UCase$(Txt(arr)) = s Then FilaDe = 1
        Exit Function
    End If
    For i = 1 To UBound(arr, 1)
        If UCase$(Txt(arr(i, 1))) = s Then
            FilaDe = i
            Exit Function
        End If
    Next i
End Function

Private Function GetC(lo As ListObject, ByVal fila As Long, ByVal col As String) As Variant
    GetC = lo.DataBodyRange.Cells(fila, lo.ListColumns(col).Index).Value
End Function

Private Sub PutC(lo As ListObject, ByVal fila As Long, ByVal col As String, ByVal valor As Variant)
    lo.DataBodyRange.Cells(fila, lo.ListColumns(col).Index).Value = valor
End Sub

' Siguiente consecutivo con prefijo (p. ej. FV-00001), mirando el máximo existente.
Private Function Siguiente(lo As ListObject, ByVal col As String, ByVal prefijo As String) As String
    Dim c As Range, s As String, n As Long, mx As Long
    If lo.ListRows.Count > 0 Then
        For Each c In lo.ListColumns(col).DataBodyRange.Cells
            s = Txt(c.Value)
            If Len(s) > Len(prefijo) And UCase$(Left$(s, Len(prefijo))) = UCase$(prefijo) Then
                If IsNumeric(Mid$(s, Len(prefijo) + 1)) Then
                    n = CLng(Mid$(s, Len(prefijo) + 1))
                    If n > mx Then mx = n
                End If
            End If
        Next c
    End If
    Siguiente = prefijo & Format$(mx + 1, "00000")
End Function

' ----- Transacciones: agregar filas y poder deshacerlas si algo falla
Private Sub IniciarTx()
    Set mTx = New Collection
End Sub

Private Function NuevaFila(lo As ListObject) As Long
    Dim reutiliza As Boolean
    If lo.ListRows.Count = 1 Then
        If EsVacio(lo.DataBodyRange.Cells(1, 1).Value) Then reutiliza = True
    End If
    If reutiliza Then
        NuevaFila = 1
    ElseIf lo.ListRows.Count = 0 Then
        NuevaFila = lo.ListRows.Add.Index
    Else
        NuevaFila = lo.ListRows.Add(AlwaysInsert:=True).Index
    End If
    If Not mTx Is Nothing Then mTx.Add lo.Name & "|" & NuevaFila
End Function

Private Sub DeshacerTx()
    Dim i As Long, p As Variant, lo As ListObject, c As Range
    On Error Resume Next
    If mTx Is Nothing Then Exit Sub
    For i = mTx.Count To 1 Step -1
        p = Split(mTx(i), "|")
        Set lo = T(CStr(p(0)))
        If lo.ListRows.Count > 1 Then
            lo.ListRows(CLng(p(1))).Delete
        Else
            For Each c In lo.ListRows(1).Range.Cells
                If Not c.HasFormula Then c.ClearContents
            Next c
        End If
    Next i
    Set mTx = Nothing
End Sub

Private Sub TerminarTx()
    Set mTx = Nothing
End Sub

' Registra una operación en el historial (hoja LOG).
Public Sub RegistrarLog(ByVal accion As String, ByVal documento As String, ByVal detalle As String)
    Dim lo As ListObject, f As Long
    On Error Resume Next
    Set lo = T("tLog")
    f = NuevaFila(lo)
    PutC lo, f, "Fecha hora", Now
    PutC lo, f, "Usuario", Usuario()
    PutC lo, f, "Acción", accion
    PutC lo, f, "Documento", documento
    PutC lo, f, "Detalle", detalle
End Sub

' ----- Protección
Private Sub Desproteger(ws As Worksheet)
    On Error Resume Next
    ws.Unprotect Password:=Clave()
End Sub

Private Sub Proteger(ws As Worksheet)
    On Error Resume Next
    ws.Protect Password:=Clave(), DrawingObjects:=True, Contents:=True, Scenarios:=True, _
               UserInterfaceOnly:=True, AllowFiltering:=True, AllowSorting:=True, AllowFormattingColumns:=True
    ws.EnableSelection = xlNoRestrictions
End Sub

Public Sub ProtegerTodo()
    Dim h As Variant
    For Each h In Split(HOJAS_PROTEGIDAS, ",")
        Proteger Hoja(CStr(h))
    Next h
End Sub

Public Sub ProtegerHojas()
    ProtegerTodo
    Aviso "Hojas de cálculo y formularios protegidos." & vbCrLf & _
          "Las hojas de datos (tablas) quedan editables para permitir agregar registros."
End Sub

Public Sub DesprotegerHojas()
    Dim c As String, h As Variant
    c = InputBox("Clave de protección (CONFIG):", APP)
    If c = "" Then Exit Sub
    If c <> Clave() Then
        MsgBox "Clave incorrecta.", vbExclamation, APP
        Exit Sub
    End If
    For Each h In Split(HOJAS_PROTEGIDAS, ",")
        Hoja(CStr(h)).Unprotect Password:=c
    Next h
    RegistrarLog "Desproteger hojas", "-", "Hojas desprotegidas por el usuario"
    MsgBox "Hojas desprotegidas. Recuerde volver a protegerlas.", vbInformation, APP
End Sub

Private Sub Inicio(Optional ByVal recalcular As Boolean = True)
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    If recalcular Then Application.Calculate
End Sub

Private Sub Fin()
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Application.StatusBar = False
End Sub

Private Sub MostrarError(ByVal titulo As String)
    Dim m As String
    m = Err.Description
    DeshacerTx
    Fin
    If mSilencio Then
        Err.Raise vbObjectError + 600, APP, titulo & ": " & m
    Else
        MsgBox titulo & vbCrLf & vbCrLf & m & vbCrLf & vbCrLf & "No se guardó ningún cambio.", vbExclamation, APP
    End If
End Sub

Private Function StockDe(ByVal prod As String) As Double
    Dim x As Variant
    x = Application.Match(prod, R("inv_Cod"), 0)
    If Not IsError(x) Then StockDe = Num(R("inv_Stock").Cells(CLng(x), 1).Value)
End Function

Private Sub Limpiar(ByVal nombres As String)
    Dim n As Variant
    For Each n In Split(nombres, ",")
        R(Trim$(CStr(n))).ClearContents
    Next n
End Sub

'==============================================================================
' 2. REGISTRO DE VENTAS
'==============================================================================

' Registra la factura del formulario F_VENTA: encabezado en VENTAS, líneas en
' VENTAS_DET y, si hay pago inmediato, un cobro en PAGOS. El inventario y la
' cartera se actualizan solos por fórmulas (sin duplicar movimientos).
Public Sub RegistrarVenta()
    Dim tv As ListObject, td As ListObject, tp As ListObject, tpr As ListObject, tc As ListObject
    Dim rg As Range, i As Long, f As Long, fp As Long, nLin As Long, lin As Long
    Dim numDoc As String, cli As String, vend As String, medio As String, cond As String
    Dim fecha As Date, plazo As Double, pago As Double, total As Double
    Dim prod As String, cant As Double, prec As Variant, desc As Double
    Dim dic As Object, k As Variant, faltan As String, autorizada As Boolean
    On Error GoTo ErrH
    Inicio
    Set tv = T("tVentas"): Set td = T("tVentasDet"): Set tp = T("tPagos")
    Set tpr = T("tProductos"): Set tc = T("tClientes")

    ' --- encabezado
    cli = Txt(V("fv_Cliente")): vend = Txt(V("fv_Vendedor"))
    medio = Txt(V("fv_Medio")): cond = Txt(V("fv_Condicion"))
    If cli = "" Then Fallo "Seleccione el cliente."
    If FilaDe(tc, "Código", cli) = 0 Then Fallo "El cliente '" & cli & "' no existe en CLIENTES."
    If UCase$(Txt(GetC(tc, FilaDe(tc, "Código", cli), "Estado"))) = "INACTIVO" Then Fallo "El cliente está INACTIVO."
    If vend = "" Then Fallo "Seleccione el vendedor."
    If medio = "" Then Fallo "Seleccione el medio de pago."
    If cond <> "Contado" And cond <> "Crédito" Then Fallo "La condición debe ser Contado o Crédito."
    fecha = FechaDe("fv_Fecha")
    numDoc = Txt(V("fv_Factura"))
    If numDoc = "" Then numDoc = Siguiente(tv, "Factura", Txt(V("cfg_PrefFactura")))
    If FilaDe(tv, "Factura", numDoc) > 0 Then Fallo "La factura " & numDoc & " ya existe. No se permiten duplicados."

    ' --- líneas
    Set rg = R("fv_Lineas")
    Set dic = CreateObject("Scripting.Dictionary")
    For i = 1 To rg.Rows.Count
        prod = Txt(rg.Cells(i, 1).Value)
        If prod <> "" Then
            f = FilaDe(tpr, "Código", prod)
            If f = 0 Then Fallo "Línea " & i & ": el producto '" & prod & "' no existe."
            If UCase$(Txt(GetC(tpr, f, "Estado"))) = "INACTIVO" Then Fallo "Línea " & i & ": el producto " & prod & " está INACTIVO."
            cant = Num(rg.Cells(i, 2).Value)
            If cant <= 0 Then Fallo "Línea " & i & ": la cantidad debe ser mayor que cero."
            If Not EsVacio(rg.Cells(i, 3).Value) And Num(rg.Cells(i, 3).Value) < 0 Then Fallo "Línea " & i & ": precio no válido."
            desc = Num(rg.Cells(i, 4).Value)
            If desc < 0 Or desc > 1 Then Fallo "Línea " & i & ": el descuento debe estar entre 0% y 100%."
            dic(prod) = dic(prod) + cant
            nLin = nLin + 1
        ElseIf Not EsVacio(rg.Cells(i, 2).Value) Then
            Fallo "Línea " & i & ": hay cantidad pero falta el producto."
        End If
    Next i
    If nLin = 0 Then Fallo "Agregue al menos una línea con producto y cantidad."

    ' --- existencias (se agrupan las cantidades del mismo producto)
    For Each k In dic.Keys
        If dic(k) > StockDe(CStr(k)) Then
            faltan = faltan & vbCrLf & "  " & k & ": pide " & dic(k) & ", disponible " & StockDe(CStr(k))
        End If
    Next k
    If faltan <> "" Then
        If UCase$(Txt(V("cfg_PermitirSinStock"))) = "SI" Then
            If Not Confirmar("Existencias insuficientes:" & faltan & vbCrLf & vbCrLf & "¿Registrar de todas formas?") Then GoTo Cancelado
            autorizada = True
        ElseIf UCase$(Txt(V("fv_Autoriza"))) = "SI" And Txt(V("fv_Clave")) = Txt(V("cfg_ClaveAutoriza")) And Txt(V("fv_Clave")) <> "" Then
            autorizada = True
        Else
            Fallo "Existencias insuficientes:" & faltan & vbCrLf & vbCrLf & _
                  "Para vender sin stock marque 'Autorizar venta sin stock' = SI e ingrese la clave de autorización."
        End If
    End If

    ' --- condiciones de pago
    total = Num(V("fv_Total"))
    If cond = "Crédito" Then
        If EsVacio(V("fv_Plazo")) Then
            plazo = Num(GetC(tc, FilaDe(tc, "Código", cli), "Plazo crédito días"))
        Else
            plazo = Num(V("fv_Plazo"))
        End If
        If plazo <= 0 Then plazo = 30
        If Num(GetC(tc, FilaDe(tc, "Código", cli), "Cupo crédito")) > 0 Then
            If total > Num(GetC(tc, FilaDe(tc, "Código", cli), "Cupo disponible")) Then
                If Not Confirmar("La venta supera el cupo de crédito disponible del cliente (" & _
                    Moneda(Num(GetC(tc, FilaDe(tc, "Código", cli), "Cupo disponible"))) & "). ¿Continuar?") Then GoTo Cancelado
            End If
        End If
    End If
    If EsVacio(V("fv_PagoHoy")) Then
        If cond = "Contado" Then
            pago = total
        Else
            pago = 0
        End If
    Else
        pago = Num(V("fv_PagoHoy"))
    End If
    If pago < 0 Or pago > total + 0.5 Then Fallo "El valor pagado hoy no puede ser negativo ni mayor que el total (" & Moneda(total) & ")."

    If Not Confirmar("¿Registrar la factura " & numDoc & "?" & vbCrLf & vbCrLf & "Total: " & Moneda(total) & vbCrLf & _
                     "Pagado hoy: " & Moneda(pago) & vbCrLf & "Condición: " & cond) Then GoTo Cancelado

    ' --- escritura (transacción)
    IniciarTx
    f = NuevaFila(tv)
    PutC tv, f, "Factura", numDoc
    PutC tv, f, "Fecha", fecha
    PutC tv, f, "Cliente", cli
    PutC tv, f, "Vendedor", vend
    PutC tv, f, "Medio de pago", medio
    PutC tv, f, "Condición", cond
    PutC tv, f, "Plazo días", IIf(cond = "Crédito", plazo, 0)
    PutC tv, f, "Estado", "Activa"
    PutC tv, f, "Observaciones", Txt(V("fv_Obs")) & IIf(autorizada, " [Venta sin stock autorizada]", "")
    PutC tv, f, "Usuario", Usuario()
    PutC tv, f, "Registrado", Now
    For i = 1 To rg.Rows.Count
        prod = Txt(rg.Cells(i, 1).Value)
        If prod <> "" Then
            lin = lin + 1
            fp = FilaDe(tpr, "Código", prod)
            prec = rg.Cells(i, 3).Value
            If EsVacio(prec) Then prec = Num(GetC(tpr, fp, "Precio venta"))
            f = NuevaFila(td)
            PutC td, f, "Factura", numDoc
            PutC td, f, "Línea", lin
            PutC td, f, "Producto", prod
            PutC td, f, "Cantidad", Num(rg.Cells(i, 2).Value)
            PutC td, f, "Precio unitario", Num(prec)
            PutC td, f, "Descuento %", Num(rg.Cells(i, 4).Value)
            PutC td, f, "IVA %", Num(GetC(tpr, fp, "IVA %"))
            If Not EsVacio(rg.Cells(i, 5).Value) Then PutC td, f, "Lote", Txt(rg.Cells(i, 5).Value)
        End If
    Next i
    If pago > 0 Then
        f = NuevaFila(tp)
        PutC tp, f, "Recibo", Siguiente(tp, "Recibo", "RC-")
        PutC tp, f, "Fecha", fecha
        PutC tp, f, "Tipo", "Cobro cliente"
        PutC tp, f, "Documento", numDoc
        PutC tp, f, "Medio de pago", medio
        PutC tp, f, "Valor", pago
        PutC tp, f, "Referencia", "Pago al facturar"
        PutC tp, f, "Estado", "Activo"
        PutC tp, f, "Usuario", Usuario()
        PutC tp, f, "Registrado", Now
    End If
    Application.Calculate
    If Abs(Num(GetC(tv, FilaDe(tv, "Factura", numDoc), "Total factura")) - total) > 1 Then
        Fallo "Verificación fallida: el total registrado no coincide con el formulario."
    End If
    TerminarTx
    RegistrarLog "Registrar venta", numDoc, "Cliente " & cli & " · " & lin & " línea(s) · total " & Moneda(total) & " · pagado " & Moneda(pago)
    mUltimoDoc = numDoc
    LimpiarVenta True
    Fin
    Aviso "Venta " & numDoc & " registrada correctamente." & vbCrLf & "Inventario y cartera actualizados."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar la venta"
End Sub

Public Sub LimpiarVenta(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fv_Factura,fv_Fecha,fv_Plazo,fv_PagoHoy,fv_Clave,fv_Obs,fv_Lineas"
    R("fv_Autoriza").Value = "NO"
    If Not silencioso Then Aviso "Formulario de venta limpio. Los registros históricos no se modificaron."
End Sub

'==============================================================================
' 2b. COMPRAS Y RECEPCIÓN
'==============================================================================

' Registra una compra. El inventario NO aumenta hasta confirmar la recepción,
' salvo que se marque "Recibir de inmediato" = SI.
Public Sub RegistrarCompra()
    Dim tco As ListObject, tdc As ListObject, tpr As ListObject, tpv As ListObject
    Dim rg As Range, i As Long, f As Long, fp As Long, nLin As Long
    Dim numDoc As String, prov As String, fecha As Date, plazo As Double, recibir As Boolean
    Dim prod As String, cant As Double, avisoLote As String
    On Error GoTo ErrH
    Inicio
    Set tco = T("tCompras"): Set tdc = T("tComprasDet"): Set tpr = T("tProductos"): Set tpv = T("tProveedores")
    prov = Txt(V("fc_Proveedor"))
    If prov = "" Then Fallo "Seleccione el proveedor."
    If FilaDe(tpv, "Código", prov) = 0 Then Fallo "El proveedor '" & prov & "' no existe."
    fecha = FechaDe("fc_Fecha")
    numDoc = Txt(V("fc_Compra"))
    If numDoc = "" Then numDoc = Siguiente(tco, "Compra", Txt(V("cfg_PrefCompra")))
    If FilaDe(tco, "Compra", numDoc) > 0 Then Fallo "La compra " & numDoc & " ya existe."
    If EsVacio(V("fc_Plazo")) Then
        plazo = Num(GetC(tpv, FilaDe(tpv, "Código", prov), "Plazo pago días"))
    Else
        plazo = Num(V("fc_Plazo"))
    End If
    If Num(V("fc_Flete")) < 0 Then Fallo "El flete no puede ser negativo."
    recibir = (UCase$(Txt(V("fc_RecibirYa"))) = "SI")
    Set rg = R("fc_Lineas")
    For i = 1 To rg.Rows.Count
        prod = Txt(rg.Cells(i, 1).Value)
        If prod <> "" Then
            fp = FilaDe(tpr, "Código", prod)
            If fp = 0 Then Fallo "Línea " & i & ": el producto '" & prod & "' no existe."
            cant = Num(rg.Cells(i, 2).Value)
            If cant <= 0 Then Fallo "Línea " & i & ": la cantidad debe ser mayor que cero."
            If Not EsVacio(rg.Cells(i, 3).Value) And Num(rg.Cells(i, 3).Value) < 0 Then Fallo "Línea " & i & ": costo no válido."
            If Not EsVacio(rg.Cells(i, 6).Value) And Not IsDate(rg.Cells(i, 6).Value) Then Fallo "Línea " & i & ": fecha de vencimiento no válida."
            If UCase$(Txt(GetC(tpr, fp, "Maneja lote"))) = "SI" And EsVacio(rg.Cells(i, 5).Value) Then avisoLote = avisoLote & " " & prod
            nLin = nLin + 1
        ElseIf Not EsVacio(rg.Cells(i, 2).Value) Then
            Fallo "Línea " & i & ": hay cantidad pero falta el producto."
        End If
    Next i
    If nLin = 0 Then Fallo "Agregue al menos una línea."
    If avisoLote <> "" Then
        If Not Confirmar("Productos que manejan lote sin lote indicado:" & avisoLote & vbCrLf & "¿Continuar sin lote?") Then GoTo Cancelado
    End If
    If Not Confirmar("¿Registrar la compra " & numDoc & " por " & Moneda(Num(V("fc_Total"))) & "?" & vbCrLf & _
                     IIf(recibir, "Se marcará como RECIBIDA (el inventario aumenta ahora).", "Quedará PENDIENTE de recepción (el inventario no cambia todavía).")) Then GoTo Cancelado
    IniciarTx
    f = NuevaFila(tco)
    PutC tco, f, "Compra", numDoc
    PutC tco, f, "Fecha", fecha
    PutC tco, f, "Proveedor", prov
    PutC tco, f, "Factura proveedor", Txt(V("fc_FacturaProv"))
    PutC tco, f, "Flete", Num(V("fc_Flete"))
    PutC tco, f, "Plazo días", plazo
    PutC tco, f, "Estado recepción", IIf(recibir, "Recibida", "Pendiente")
    If recibir Then
        PutC tco, f, "Fecha recepción", fecha
        PutC tco, f, "Recibido por", Usuario()
    End If
    PutC tco, f, "Observaciones", Txt(V("fc_Obs"))
    PutC tco, f, "Usuario", Usuario()
    PutC tco, f, "Registrado", Now
    For i = 1 To rg.Rows.Count
        prod = Txt(rg.Cells(i, 1).Value)
        If prod <> "" Then
            fp = FilaDe(tpr, "Código", prod)
            f = NuevaFila(tdc)
            PutC tdc, f, "Compra", numDoc
            PutC tdc, f, "Producto", prod
            PutC tdc, f, "Cantidad", Num(rg.Cells(i, 2).Value)
            If EsVacio(rg.Cells(i, 3).Value) Then
                PutC tdc, f, "Costo unitario", Num(GetC(tpr, fp, "Costo compra"))
            Else
                PutC tdc, f, "Costo unitario", Num(rg.Cells(i, 3).Value)
            End If
            If EsVacio(rg.Cells(i, 4).Value) Then
                PutC tdc, f, "IVA %", Num(GetC(tpr, fp, "IVA %"))
            Else
                PutC tdc, f, "IVA %", Num(rg.Cells(i, 4).Value)
            End If
            If Not EsVacio(rg.Cells(i, 5).Value) Then PutC tdc, f, "Lote", Txt(rg.Cells(i, 5).Value)
            If Not EsVacio(rg.Cells(i, 6).Value) Then PutC tdc, f, "Fecha vencimiento", CDate(rg.Cells(i, 6).Value)
        End If
    Next i
    Application.Calculate
    TerminarTx
    RegistrarLog "Registrar compra", numDoc, "Proveedor " & prov & " · " & nLin & " línea(s) · " & IIf(recibir, "recibida", "pendiente")
    mUltimoDoc = numDoc
    LimpiarCompra True
    R("fr_Compra").Value = numDoc
    Fin
    Aviso "Compra " & numDoc & " registrada." & IIf(recibir, " Inventario actualizado.", vbCrLf & "Cuando llegue la mercancía use CONFIRMAR RECEPCIÓN.")
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar la compra"
End Sub

' Confirma la recepción de una compra pendiente: el inventario aumenta en ese momento.
' Una compra ya recibida no puede recibirse dos veces (evita duplicar entradas).
Public Sub RecibirCompra()
    Dim tco As ListObject, f As Long, numDoc As String, est As String, quien As String
    On Error GoTo ErrH
    Inicio
    Set tco = T("tCompras")
    numDoc = Txt(V("fr_Compra"))
    If numDoc = "" Then Fallo "Indique el número de la compra a recibir."
    f = FilaDe(tco, "Compra", numDoc)
    If f = 0 Then Fallo "La compra " & numDoc & " no existe."
    est = Txt(GetC(tco, f, "Estado recepción"))
    If est = "Recibida" Then Fallo "La compra " & numDoc & " ya fue recibida el " & Format$(GetC(tco, f, "Fecha recepción"), "dd/mm/yyyy") & ". No se duplica el ingreso."
    If est = "Anulada" Then Fallo "La compra " & numDoc & " está anulada."
    quien = Txt(V("fr_RecibidoPor"))
    If quien = "" Then quien = Usuario()
    If Not Confirmar("¿Confirmar la recepción de " & numDoc & " (" & Txt(GetC(tco, f, "Nombre proveedor")) & ")?" & vbCrLf & _
                     "El inventario aumentará con las cantidades de la compra.") Then GoTo Cancelado
    PutC tco, f, "Estado recepción", "Recibida"
    PutC tco, f, "Fecha recepción", FechaDe("fr_Fecha")
    PutC tco, f, "Recibido por", quien
    Application.Calculate
    RegistrarLog "Recibir compra", numDoc, "Recibida por " & quien
    Limpiar "fr_Compra,fr_RecibidoPor,fr_Fecha"
    Fin
    Aviso "Mercancía de la compra " & numDoc & " recibida. Inventario actualizado."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo confirmar la recepción"
End Sub

Public Sub LimpiarCompra(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fc_Compra,fc_Fecha,fc_FacturaProv,fc_Flete,fc_Plazo,fc_Obs,fc_Lineas"
    R("fc_RecibirYa").Value = "NO"
    If Not silencioso Then Aviso "Formulario de compra limpio. Los registros históricos no se modificaron."
End Sub

'==============================================================================
' 2c. GASTOS, PAGOS Y ABONOS
'==============================================================================

Public Sub RegistrarGasto()
    Dim tg As ListObject, f As Long, numDoc As String, cat As String, valor As Double
    On Error GoTo ErrH
    Inicio
    Set tg = T("tGastos")
    cat = Txt(V("fg_Categoria")): valor = Num(V("fg_Valor"))
    If cat = "" Then Fallo "Seleccione la categoría del gasto."
    If FilaDe(T("tCatGasto"), "Categoría", cat) = 0 Then Fallo "La categoría no existe en CONFIG."
    If Txt(V("fg_Descripcion")) = "" Then Fallo "Escriba la descripción del gasto."
    If Txt(V("fg_Medio")) = "" Then Fallo "Seleccione el medio de pago."
    If valor <= 0 Then Fallo "El valor del gasto debe ser mayor que cero."
    If Not Confirmar("¿Registrar gasto de " & Moneda(valor) & " (" & cat & ")?") Then GoTo Cancelado
    IniciarTx
    numDoc = Siguiente(tg, "Gasto", "GS-")
    f = NuevaFila(tg)
    PutC tg, f, "Gasto", numDoc
    PutC tg, f, "Fecha", FechaDe("fg_Fecha")
    PutC tg, f, "Categoría", cat
    PutC tg, f, "Descripción", Txt(V("fg_Descripcion"))
    PutC tg, f, "Beneficiario", Txt(V("fg_Beneficiario"))
    PutC tg, f, "Medio de pago", Txt(V("fg_Medio"))
    PutC tg, f, "Valor", valor
    PutC tg, f, "Comprobante", Txt(V("fg_Comprobante"))
    PutC tg, f, "Estado", "Pagado"
    PutC tg, f, "Usuario", Usuario()
    PutC tg, f, "Registrado", Now
    TerminarTx
    RegistrarLog "Registrar gasto", numDoc, cat & " · " & Moneda(valor)
    mUltimoDoc = numDoc
    LimpiarGasto True
    Fin
    Aviso "Gasto " & numDoc & " registrado. Caja y estado de resultados actualizados."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar el gasto"
End Sub

Public Sub LimpiarGasto(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fg_Fecha,fg_Categoria,fg_Descripcion,fg_Beneficiario,fg_Valor,fg_Comprobante"
    If Not silencioso Then Aviso "Formulario de gasto limpio."
End Sub

' Registra un abono de cliente o un pago a proveedor contra su documento.
' La cartera (CxC/CxP) y la caja se recalculan a partir de esta única fila.
Public Sub RegistrarPago()
    Dim tp As ListObject, lo As ListObject, f As Long, fd As Long
    Dim tipo As String, doc As String, valor As Double, saldo As Double, numDoc As String
    On Error GoTo ErrH
    Inicio
    Set tp = T("tPagos")
    tipo = Txt(V("fp_Tipo")): doc = Txt(V("fp_Documento")): valor = Num(V("fp_Valor"))
    If tipo <> "Cobro cliente" And tipo <> "Pago proveedor" Then Fallo "Seleccione el tipo: Cobro cliente o Pago proveedor."
    If doc = "" Then Fallo "Indique el documento (factura o compra)."
    If Txt(V("fp_Medio")) = "" Then Fallo "Seleccione el medio de pago."
    If valor <= 0 Then Fallo "El valor debe ser mayor que cero."
    If tipo = "Cobro cliente" Then
        Set lo = T("tVentas")
        fd = FilaDe(lo, "Factura", doc)
        If fd = 0 Then Fallo "La factura " & doc & " no existe."
        If Txt(GetC(lo, fd, "Estado")) = "Anulada" Then Fallo "La factura " & doc & " está anulada."
        saldo = Num(GetC(lo, fd, "Saldo"))
        If saldo <= 0.5 Then Fallo "La factura " & doc & " no tiene saldo pendiente."
        If valor > saldo + 0.5 Then Fallo "El abono (" & Moneda(valor) & ") supera el saldo pendiente (" & Moneda(saldo) & ")."
    Else
        Set lo = T("tCompras")
        fd = FilaDe(lo, "Compra", doc)
        If fd = 0 Then Fallo "La compra " & doc & " no existe."
        If Txt(GetC(lo, fd, "Estado recepción")) = "Anulada" Then Fallo "La compra " & doc & " está anulada."
        If Txt(GetC(lo, fd, "Estado recepción")) = "Recibida" Then
            saldo = Num(GetC(lo, fd, "Saldo"))
            If saldo <= 0.5 Then Fallo "La compra " & doc & " no tiene saldo pendiente."
            If valor > saldo + 0.5 Then Fallo "El pago (" & Moneda(valor) & ") supera el saldo pendiente (" & Moneda(saldo) & ")."
        Else
            saldo = Num(GetC(lo, fd, "Total compra")) - Num(GetC(lo, fd, "Pagado"))
            If valor > saldo + 0.5 Then Fallo "El anticipo supera el total de la compra."
            If Not Confirmar("La compra aún no se ha recibido. El pago quedará como ANTICIPO. ¿Continuar?") Then GoTo Cancelado
        End If
    End If
    If Not Confirmar("¿Registrar " & LCase$(tipo) & " de " & Moneda(valor) & " al documento " & doc & "?" & vbCrLf & _
                     "Saldo después del pago: " & Moneda(saldo - valor)) Then GoTo Cancelado
    IniciarTx
    numDoc = Siguiente(tp, "Recibo", "RC-")
    f = NuevaFila(tp)
    PutC tp, f, "Recibo", numDoc
    PutC tp, f, "Fecha", FechaDe("fp_Fecha")
    PutC tp, f, "Tipo", tipo
    PutC tp, f, "Documento", doc
    PutC tp, f, "Medio de pago", Txt(V("fp_Medio"))
    PutC tp, f, "Valor", valor
    PutC tp, f, "Referencia", Txt(V("fp_Referencia"))
    PutC tp, f, "Estado", "Activo"
    PutC tp, f, "Observaciones", Txt(V("fp_Obs"))
    PutC tp, f, "Usuario", Usuario()
    PutC tp, f, "Registrado", Now
    TerminarTx
    RegistrarLog "Registrar " & LCase$(tipo), numDoc, "Documento " & doc & " · " & Moneda(valor)
    mUltimoDoc = numDoc
    LimpiarPago True
    Fin
    Aviso "Recibo " & numDoc & " registrado. Saldo del documento: " & Moneda(saldo - valor)
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar el pago"
End Sub

Public Sub LimpiarPago(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fp_Documento,fp_Fecha,fp_Valor,fp_Referencia,fp_Obs"
    If Not silencioso Then Aviso "Formulario de pagos limpio."
End Sub

'==============================================================================
' 3. AJUSTES, OTROS MOVIMIENTOS, CIERRE DE CAJA Y ANULACIONES
'==============================================================================

Public Sub RegistrarAjuste()
    Dim ta As ListObject, tt As ListObject, f As Long, ft As Long, numDoc As String
    Dim prod As String, tipo As String, cant As Double, signo As Double
    On Error GoTo ErrH
    Inicio
    Set ta = T("tAjustes"): Set tt = T("tTiposAjuste")
    prod = Txt(V("fa_Producto")): tipo = Txt(V("fa_Tipo")): cant = Num(V("fa_Cantidad"))
    If prod = "" Or FilaDe(T("tProductos"), "Código", prod) = 0 Then Fallo "Seleccione un producto existente."
    ft = FilaDe(tt, "Tipo", tipo)
    If ft = 0 Then Fallo "Seleccione un tipo de ajuste válido."
    If cant <= 0 Then Fallo "La cantidad debe ser mayor que cero (el signo lo define el tipo)."
    If Txt(V("fa_Motivo")) = "" Then Fallo "Escriba el motivo del ajuste."
    If Txt(V("fa_Responsable")) = "" Then Fallo "Indique el responsable."
    If Not EsVacio(V("fa_Vence")) And Not IsDate(V("fa_Vence")) Then Fallo "Fecha de vencimiento no válida."
    signo = Num(GetC(tt, ft, "Signo"))
    If signo < 0 And cant > StockDe(prod) Then
        If Not Confirmar("La salida (" & cant & ") supera el stock actual (" & StockDe(prod) & "). El stock quedará NEGATIVO. ¿Continuar?") Then GoTo Cancelado
    End If
    If Not Confirmar("¿Registrar " & tipo & " de " & cant & " unidad(es) de " & prod & "?") Then GoTo Cancelado
    IniciarTx
    numDoc = Siguiente(ta, "Ajuste", "AJ-")
    f = NuevaFila(ta)
    PutC ta, f, "Ajuste", numDoc
    PutC ta, f, "Fecha", FechaDe("fa_Fecha")
    PutC ta, f, "Producto", prod
    PutC ta, f, "Tipo", tipo
    PutC ta, f, "Cantidad", cant
    PutC ta, f, "Lote", Txt(V("fa_Lote"))
    If Not EsVacio(V("fa_Vence")) Then PutC ta, f, "Fecha vencimiento", CDate(V("fa_Vence"))
    PutC ta, f, "Motivo", Txt(V("fa_Motivo"))
    PutC ta, f, "Responsable", Txt(V("fa_Responsable"))
    PutC ta, f, "Usuario", Usuario()
    PutC ta, f, "Registrado", Now
    TerminarTx
    RegistrarLog "Ajuste de inventario", numDoc, tipo & " · " & prod & " · " & cant
    mUltimoDoc = numDoc
    LimpiarAjuste True
    Fin
    Aviso "Ajuste " & numDoc & " registrado. Inventario actualizado."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar el ajuste"
End Sub

Public Sub LimpiarAjuste(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fa_Fecha,fa_Producto,fa_Tipo,fa_Cantidad,fa_Lote,fa_Vence,fa_Motivo,fa_Responsable"
    If Not silencioso Then Aviso "Formulario de ajuste limpio."
End Sub

Public Sub RegistrarMovCaja()
    Dim tm As ListObject, f As Long, numDoc As String, valor As Double
    On Error GoTo ErrH
    Inicio
    Set tm = T("tMovCaja")
    valor = Num(V("fm_Valor"))
    If Txt(V("fm_Tipo")) <> "Ingreso" And Txt(V("fm_Tipo")) <> "Egreso" Then Fallo "Seleccione Ingreso o Egreso."
    If Txt(V("fm_Concepto")) = "" Then Fallo "Seleccione el concepto."
    If Txt(V("fm_Medio")) = "" Then Fallo "Seleccione el medio de pago."
    If valor <= 0 Then Fallo "El valor debe ser mayor que cero."
    If Not Confirmar("¿Registrar " & LCase$(Txt(V("fm_Tipo"))) & " de " & Moneda(valor) & " (" & Txt(V("fm_Concepto")) & ")?") Then GoTo Cancelado
    IniciarTx
    numDoc = Siguiente(tm, "Movimiento", "MC-")
    f = NuevaFila(tm)
    PutC tm, f, "Movimiento", numDoc
    PutC tm, f, "Fecha", FechaDe("fm_Fecha")
    PutC tm, f, "Tipo", Txt(V("fm_Tipo"))
    PutC tm, f, "Concepto", Txt(V("fm_Concepto"))
    PutC tm, f, "Medio de pago", Txt(V("fm_Medio"))
    PutC tm, f, "Valor", valor
    PutC tm, f, "Detalle", Txt(V("fm_Detalle"))
    PutC tm, f, "Estado", "Activo"
    PutC tm, f, "Usuario", Usuario()
    PutC tm, f, "Registrado", Now
    TerminarTx
    RegistrarLog "Movimiento de caja", numDoc, Txt(V("fm_Tipo")) & " · " & Txt(V("fm_Concepto")) & " · " & Moneda(valor)
    mUltimoDoc = numDoc
    LimpiarMovCaja True
    Fin
    Aviso "Movimiento " & numDoc & " registrado."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar el movimiento"
End Sub

Public Sub LimpiarMovCaja(Optional ByVal silencioso As Boolean = False)
    On Error Resume Next
    Limpiar "fm_Fecha,fm_Concepto,fm_Valor,fm_Detalle"
    If Not silencioso Then Aviso "Formulario de movimiento limpio."
End Sub

' Cierre diario: guarda el efectivo contado; la hoja CIERRES calcula el saldo
' esperado y la diferencia (conciliación).
Public Sub RegistrarCierre()
    Dim tk As ListObject, f As Long, fecha As Date, dif As Double
    On Error GoTo ErrH
    Inicio
    Set tk = T("tCierres")
    fecha = FechaDe("fk_Fecha")
    If EsVacio(V("fk_Contado")) Then Fallo "Ingrese el efectivo contado."
    If Num(V("fk_Contado")) < 0 Then Fallo "El efectivo contado no puede ser negativo."
    If Txt(V("fk_Responsable")) = "" Then Fallo "Indique el responsable del cierre."
    If FilaDe(tk, "Fecha", CStr(fecha)) > 0 Then Fallo "Ya existe un cierre para el " & Format$(fecha, "dd/mm/yyyy") & ". Corríjalo directamente en CIERRES."
    IniciarTx
    f = NuevaFila(tk)
    PutC tk, f, "Fecha", fecha
    PutC tk, f, "Efectivo contado", Num(V("fk_Contado"))
    PutC tk, f, "Responsable", Txt(V("fk_Responsable"))
    PutC tk, f, "Observaciones", Txt(V("fk_Obs"))
    PutC tk, f, "Usuario", Usuario()
    PutC tk, f, "Registrado", Now
    Application.Calculate
    dif = Num(GetC(tk, f, "Diferencia"))
    TerminarTx
    RegistrarLog "Cierre de caja", Format$(fecha, "dd/mm/yyyy"), "Contado " & Moneda(Num(V("fk_Contado"))) & " · diferencia " & Moneda(dif)
    Limpiar "fk_Fecha,fk_Contado,fk_Obs"
    Fin
    If Abs(dif) < 1 Then
        Aviso "Cierre registrado: la caja CUADRA."
    Else
        Aviso "Cierre registrado con DIFERENCIA de " & Moneda(dif) & IIf(dif > 0, " (sobrante).", " (faltante)."), vbExclamation
    End If
    Exit Sub
ErrH:
    MostrarError "No se pudo registrar el cierre"
End Sub

' Anula un documento cambiando su estado (nunca se borra: queda la trazabilidad).
Public Sub AnularDocumento()
    Dim tipo As String, doc As String, motivo As String, lo As ListObject
    Dim colId As String, colEst As String, valAnul As String, colObs As String
    Dim f As Long, i As Long, tp As ListObject, n As Long
    On Error GoTo ErrH
    Inicio
    tipo = Txt(V("fx_Tipo")): doc = Txt(V("fx_Documento")): motivo = Txt(V("fx_Motivo"))
    If doc = "" Then Fallo "Indique el número del documento."
    If motivo = "" Then Fallo "Escriba el motivo de la anulación."
    Select Case tipo
        Case "Venta": Set lo = T("tVentas"): colId = "Factura": colEst = "Estado": valAnul = "Anulada": colObs = "Observaciones"
        Case "Compra": Set lo = T("tCompras"): colId = "Compra": colEst = "Estado recepción": valAnul = "Anulada": colObs = "Observaciones"
        Case "Pago": Set lo = T("tPagos"): colId = "Recibo": colEst = "Estado": valAnul = "Anulado": colObs = "Observaciones"
        Case "Gasto": Set lo = T("tGastos"): colId = "Gasto": colEst = "Estado": valAnul = "Anulado": colObs = "Descripción"
        Case "Otro movimiento": Set lo = T("tMovCaja"): colId = "Movimiento": colEst = "Estado": valAnul = "Anulado": colObs = "Detalle"
        Case Else: Fallo "Seleccione el tipo de documento."
    End Select
    f = FilaDe(lo, colId, doc)
    If f = 0 Then Fallo "No existe el documento " & doc & " en " & lo.Name & "."
    If Txt(GetC(lo, f, colEst)) = valAnul Then Fallo "El documento ya está anulado."
    If tipo = "Compra" And Txt(GetC(lo, f, colEst)) = "Recibida" Then
        If Not Confirmar("La compra ya fue RECIBIDA. Al anularla, sus unidades saldrán del inventario. ¿Continuar?") Then GoTo Cancelado
    End If
    If Not Confirmar("¿Anular " & LCase$(tipo) & " " & doc & "?" & vbCrLf & "Motivo: " & motivo) Then GoTo Cancelado
    PutC lo, f, colEst, valAnul
    PutC lo, f, colObs, Txt(GetC(lo, f, colObs)) & " [ANULADO " & Format$(Now, "dd/mm/yyyy hh:nn") & " por " & Usuario() & ": " & motivo & "]"
    ' cobros/pagos asociados a una venta o compra anulada
    If tipo = "Venta" Or tipo = "Compra" Then
        Set tp = T("tPagos")
        For i = 1 To tp.ListRows.Count
            If UCase$(Txt(GetC(tp, i, "Documento"))) = UCase$(doc) And Txt(GetC(tp, i, "Estado")) = "Activo" Then n = n + 1
        Next i
        If n > 0 Then
            If Confirmar("El documento tiene " & n & " cobro(s)/pago(s) activos. ¿Anularlos también (devolución del dinero)?") Then
                For i = 1 To tp.ListRows.Count
                    If UCase$(Txt(GetC(tp, i, "Documento"))) = UCase$(doc) And Txt(GetC(tp, i, "Estado")) = "Activo" Then
                        PutC tp, i, "Estado", "Anulado"
                        PutC tp, i, "Observaciones", Txt(GetC(tp, i, "Observaciones")) & " [Anulado con " & doc & "]"
                    End If
                Next i
            End If
        End If
    End If
    Application.Calculate
    RegistrarLog "Anular " & LCase$(tipo), doc, motivo
    Limpiar "fx_Documento,fx_Motivo"
    Fin
    Aviso LCase$(tipo) & " " & doc & " anulada. Los saldos e inventario se recalcularon."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudo anular el documento"
End Sub

'==============================================================================
' 4. CONSULTAS, KARDEX Y PEDIDOS
'==============================================================================

' Lista todos los productos cuyo código, código de barras o nombre contienen el texto.
Public Sub ConsultarProducto()
    Dim ws As Worksheet, lo As ListObject, i As Long, nr As Long, q As String, destino As Range
    On Error GoTo ErrH
    Inicio
    Set ws = Hoja("F_CONSULTA"): Set lo = T("tProductos")
    q = UCase$(Txt(V("fq_Texto")))
    Set destino = R("fq_Lista")
    Desproteger ws
    destino.Resize(300, 3).ClearContents
    destino.Resize(1, 3).Value = Array("Código", "Nombre · categoría", "Stock · precio")
    destino.Resize(1, 3).Font.Bold = True
    nr = 1
    If q <> "" Then
        For i = 1 To lo.ListRows.Count
            If InStr(1, UCase$(Txt(GetC(lo, i, "Código")) & "|" & Txt(GetC(lo, i, "Código de barras")) & "|" & Txt(GetC(lo, i, "Nombre"))), q) > 0 Then
                destino.Offset(nr, 0).Value = Txt(GetC(lo, i, "Código"))
                destino.Offset(nr, 1).Value = Txt(GetC(lo, i, "Nombre")) & " · " & Txt(GetC(lo, i, "Categoría"))
                destino.Offset(nr, 2).Value = "Stock " & StockDe(Txt(GetC(lo, i, "Código"))) & " · " & Moneda(Num(GetC(lo, i, "Precio venta")))
                nr = nr + 1
                If nr > 299 Then Exit For
            End If
        Next i
    End If
    Proteger ws
    Fin
    Aviso (nr - 1) & " producto(s) encontrado(s)."
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "Error en la consulta"
End Sub

Public Sub BuscarCliente()
    Dim ws As Worksheet, lo As ListObject, i As Long, nr As Long, q As String, destino As Range
    On Error GoTo ErrH
    Inicio
    Set ws = Hoja("F_CONSULTA"): Set lo = T("tClientes")
    q = UCase$(Txt(V("fqc_Texto")))
    Set destino = R("fqc_Lista")
    Desproteger ws
    destino.Resize(300, 3).ClearContents
    destino.Resize(1, 3).Value = Array("Código", "Nombre · NIT", "Saldo pendiente")
    destino.Resize(1, 3).Font.Bold = True
    nr = 1
    If q <> "" Then
        For i = 1 To lo.ListRows.Count
            If InStr(1, UCase$(Txt(GetC(lo, i, "Código")) & "|" & Txt(GetC(lo, i, "NIT CC")) & "|" & Txt(GetC(lo, i, "Nombre"))), q) > 0 Then
                destino.Offset(nr, 0).Value = Txt(GetC(lo, i, "Código"))
                destino.Offset(nr, 1).Value = Txt(GetC(lo, i, "Nombre")) & " · " & Txt(GetC(lo, i, "NIT CC"))
                destino.Offset(nr, 2).Value = Num(GetC(lo, i, "Saldo pendiente"))
                destino.Offset(nr, 2).NumberFormat = """$"" #,##0"
                nr = nr + 1
                If nr > 299 Then Exit For
            End If
        Next i
    End If
    Proteger ws
    Fin
    Aviso (nr - 1) & " cliente(s) encontrado(s)."
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "Error en la búsqueda"
End Sub

' Kardex cronológico del producto seleccionado en KARDEX (entradas, salidas, saldo).
Public Sub GenerarKardex()
    Dim ws As Worksheet, prod As String, n As Long, i As Long, j As Long
    Dim fe() As Double, ti() As String, dc() As String, te() As String, lt() As String, q() As Double
    Dim lo As ListObject, saldo As Double, costo As Double, destino As Range
    Dim tmpD As Double, tmpS As String, tmpQ As Double, k As Long
    On Error GoTo ErrH
    Inicio
    Set ws = Hoja("KARDEX")
    prod = Txt(V("kx_Producto"))
    If prod = "" Then Fallo "Seleccione un producto."
    If FilaDe(T("tProductos"), "Código", prod) = 0 Then Fallo "El producto no existe."
    costo = Num(GetC(T("tProductos"), FilaDe(T("tProductos"), "Código", prod), "Costo unitario real"))
    ReDim fe(1 To 1): ReDim ti(1 To 1): ReDim dc(1 To 1): ReDim te(1 To 1): ReDim lt(1 To 1): ReDim q(1 To 1)
    ' ajustes
    Set lo = T("tAjustes")
    For i = 1 To lo.ListRows.Count
        If UCase$(Txt(GetC(lo, i, "Producto"))) = UCase$(prod) And IsDate(GetC(lo, i, "Fecha")) Then
            n = n + 1: AmpliarK n, fe, ti, dc, te, lt, q
            fe(n) = CDbl(CDate(GetC(lo, i, "Fecha"))): ti(n) = Txt(GetC(lo, i, "Tipo")): dc(n) = Txt(GetC(lo, i, "Ajuste"))
            te(n) = Txt(GetC(lo, i, "Motivo")): lt(n) = Txt(GetC(lo, i, "Lote")): q(n) = Num(GetC(lo, i, "Cantidad neta"))
        End If
    Next i
    ' compras recibidas
    Set lo = T("tComprasDet")
    For i = 1 To lo.ListRows.Count
        If UCase$(Txt(GetC(lo, i, "Producto"))) = UCase$(prod) And Num(GetC(lo, i, "Cantidad recibida")) <> 0 And IsDate(GetC(lo, i, "Fecha recepción")) Then
            n = n + 1: AmpliarK n, fe, ti, dc, te, lt, q
            fe(n) = CDbl(CDate(GetC(lo, i, "Fecha recepción"))): ti(n) = "Compra recibida": dc(n) = Txt(GetC(lo, i, "Compra"))
            te(n) = Txt(GetC(lo, i, "Proveedor")): lt(n) = Txt(GetC(lo, i, "Lote")): q(n) = Num(GetC(lo, i, "Cantidad recibida"))
        End If
    Next i
    ' ventas activas
    Set lo = T("tVentasDet")
    For i = 1 To lo.ListRows.Count
        If UCase$(Txt(GetC(lo, i, "Producto"))) = UCase$(prod) And Num(GetC(lo, i, "Cantidad efectiva")) <> 0 And IsDate(GetC(lo, i, "Fecha")) Then
            n = n + 1: AmpliarK n, fe, ti, dc, te, lt, q
            fe(n) = CDbl(CDate(GetC(lo, i, "Fecha"))): ti(n) = "Venta": dc(n) = Txt(GetC(lo, i, "Factura"))
            te(n) = Txt(GetC(lo, i, "Cliente")): lt(n) = Txt(GetC(lo, i, "Lote")): q(n) = -Num(GetC(lo, i, "Cantidad efectiva"))
        End If
    Next i
    ' orden cronológico (inserción; ante empate, primero entradas)
    For i = 2 To n
        j = i
        Do While j > 1
            If fe(j - 1) > fe(j) Or (fe(j - 1) = fe(j) And q(j - 1) < 0 And q(j) > 0) Then
                tmpD = fe(j): fe(j) = fe(j - 1): fe(j - 1) = tmpD
                tmpQ = q(j): q(j) = q(j - 1): q(j - 1) = tmpQ
                tmpS = ti(j): ti(j) = ti(j - 1): ti(j - 1) = tmpS
                tmpS = dc(j): dc(j) = dc(j - 1): dc(j - 1) = tmpS
                tmpS = te(j): te(j) = te(j - 1): te(j - 1) = tmpS
                tmpS = lt(j): lt(j) = lt(j - 1): lt(j - 1) = tmpS
                j = j - 1
            Else
                Exit Do
            End If
        Loop
    Next i
    Desproteger ws
    Set destino = R("kx_Detalle")
    ws.Range(destino, destino.Offset(20000, 9)).ClearContents
    For k = 1 To n
        saldo = saldo + q(k)
        destino.Offset(k - 1, 0).Value = CDate(fe(k))
        destino.Offset(k - 1, 1).Value = ti(k)
        destino.Offset(k - 1, 2).Value = dc(k)
        destino.Offset(k - 1, 3).Value = te(k)
        destino.Offset(k - 1, 4).Value = lt(k)
        If q(k) >= 0 Then
            destino.Offset(k - 1, 5).Value = q(k)
        Else
            destino.Offset(k - 1, 6).Value = -q(k)
        End If
        destino.Offset(k - 1, 7).Value = saldo
        destino.Offset(k - 1, 8).Value = costo
        destino.Offset(k - 1, 9).Value = saldo * costo
    Next k
    If n > 0 Then
        destino.Resize(n, 1).NumberFormat = "dd/mm/yyyy"
        destino.Offset(0, 5).Resize(n, 3).NumberFormat = "#,##0.##"
        destino.Offset(0, 8).Resize(n, 2).NumberFormat = """$"" #,##0"
    Else
        destino.Value = "El producto no tiene movimientos."
    End If
    Proteger ws
    Fin
    If n > 0 Then
        If Abs(saldo - StockDe(prod)) > 0.001 Then
            Aviso "Kardex generado (" & n & " movimientos). ATENCIÓN: el saldo del kardex (" & saldo & ") no coincide con INVENTARIO (" & StockDe(prod) & ").", vbExclamation
        Else
            Aviso "Kardex generado: " & n & " movimientos. Saldo final " & saldo & " (coincide con INVENTARIO)."
        End If
    End If
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "No se pudo generar el kardex"
End Sub

Private Sub AmpliarK(ByVal n As Long, fe() As Double, ti() As String, dc() As String, te() As String, lt() As String, q() As Double)
    If n > UBound(fe) Then
        ReDim Preserve fe(1 To n * 2): ReDim Preserve ti(1 To n * 2): ReDim Preserve dc(1 To n * 2)
        ReDim Preserve te(1 To n * 2): ReDim Preserve lt(1 To n * 2): ReDim Preserve q(1 To n * 2)
    End If
End Sub

' Crea una orden de compra PENDIENTE por proveedor con las cantidades sugeridas en
' REPOSICION. Como las órdenes quedan "en tránsito", el producto sale de la lista
' y no se generan órdenes duplicadas.
Public Sub GenerarPedidos()
    Dim ws As Worksheet, i As Long, f As Long, prov As String, prods As Object, k As Variant
    Dim tco As ListObject, tdc As ListObject, numDoc As String, nOrd As Long, sinProv As String, valor As Double
    Dim filas As Object, lista As Variant, j As Long
    On Error GoTo ErrH
    Inicio
    Set ws = Hoja("REPOSICION")
    Set tco = T("tCompras"): Set tdc = T("tComprasDet")
    Set prods = CreateObject("Scripting.Dictionary")
    For i = 7 To 106
        If Txt(ws.Cells(i, 2).Value) <> "" Then
            prov = Txt(ws.Cells(i, 12).Value)
            If prov = "" Or FilaDe(T("tProveedores"), "Código", prov) = 0 Then
                sinProv = sinProv & " " & Txt(ws.Cells(i, 2).Value)
            Else
                If Not prods.Exists(prov) Then
                    prods.Add prov, CStr(i)
                Else
                    prods(prov) = prods(prov) & "," & i
                End If
                valor = valor + Num(ws.Cells(i, 15).Value)
            End If
        End If
    Next i
    If prods.Count = 0 Then
        Fin
        Aviso "No hay productos para reponer" & IIf(sinProv <> "", " con proveedor asignado (sin proveedor:" & sinProv & ").", ".")
        Exit Sub
    End If
    If Not Confirmar("Se crearán " & prods.Count & " orden(es) de compra PENDIENTES por un valor estimado de " & Moneda(valor) & "." & _
                     IIf(sinProv <> "", vbCrLf & "Productos sin proveedor (no incluidos):" & sinProv, "") & vbCrLf & "¿Continuar?") Then GoTo Cancelado
    IniciarTx
    For Each k In prods.Keys
        numDoc = Siguiente(tco, "Compra", Txt(V("cfg_PrefCompra")))
        f = NuevaFila(tco)
        PutC tco, f, "Compra", numDoc
        PutC tco, f, "Fecha", Date
        PutC tco, f, "Proveedor", CStr(k)
        PutC tco, f, "Flete", 0
        PutC tco, f, "Plazo días", Num(GetC(T("tProveedores"), FilaDe(T("tProveedores"), "Código", CStr(k)), "Plazo pago días"))
        PutC tco, f, "Estado recepción", "Pendiente"
        PutC tco, f, "Observaciones", "Orden generada automáticamente desde REPOSICIÓN"
        PutC tco, f, "Usuario", Usuario()
        PutC tco, f, "Registrado", Now
        lista = Split(prods(k), ",")
        For j = 0 To UBound(lista)
            i = CLng(lista(j))
            f = NuevaFila(tdc)
            PutC tdc, f, "Compra", numDoc
            PutC tdc, f, "Producto", Txt(ws.Cells(i, 2).Value)
            PutC tdc, f, "Cantidad", Num(ws.Cells(i, 11).Value)
            PutC tdc, f, "Costo unitario", Num(ws.Cells(i, 14).Value)
            PutC tdc, f, "IVA %", Num(GetC(T("tProductos"), FilaDe(T("tProductos"), "Código", Txt(ws.Cells(i, 2).Value)), "IVA %"))
        Next j
        nOrd = nOrd + 1
        RegistrarLog "Generar orden de compra", numDoc, "Proveedor " & k & " · " & (UBound(lista) + 1) & " producto(s)"
    Next k
    TerminarTx
    Application.Calculate
    Fin
    Aviso nOrd & " orden(es) de compra creadas en estado PENDIENTE (ver COMPRAS). Confírmelas en F_COMPRA cuando llegue la mercancía."
    Exit Sub
Cancelado:
    Fin
    Exit Sub
ErrH:
    MostrarError "No se pudieron generar los pedidos"
End Sub

'==============================================================================
' 5. DASHBOARD, INFORMES Y EXPORTACIONES
'==============================================================================

Public Sub ActualizarDashboard()
    Dim ws As Worksheet
    On Error GoTo ErrH
    Application.StatusBar = "Recalculando todo el sistema..."
    Application.CalculateFull
    Set ws = Hoja("DASHBOARD")
    Desproteger ws
    R("dash_Actualizado").Value = Now
    Proteger ws
    Application.StatusBar = False
    ws.Activate
    ws.Range("A1").Select
    Aviso "Dashboard actualizado: " & Format$(Now, "dd/mm/yyyy hh:nn")
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "No se pudo actualizar el dashboard"
End Sub

Private Function Cumple(ByVal valor As Variant, ByVal crit As String) As Boolean
    Cumple = (crit = "*" Or crit = "" Or UCase$(Txt(valor)) = UCase$(crit))
End Function

Private Function EnRango(ByVal f As Variant, ByVal d1 As Date, ByVal d2 As Date) As Boolean
    If IsDate(f) Then EnRango = (CDate(f) >= d1 And CDate(f) <= d2)
End Function

' Genera el detalle del informe elegido en INFORMES (tipo y filtros).
Public Sub GenerarInforme()
    Dim ws As Worksheet, tipo As String, d1 As Date, d2 As Date
    Dim cP As String, cC As String, cCl As String, cPr As String, cV As String, cG As String
    Dim lo As ListObject, i As Long, filas As Collection, enc As Variant, fmt As Variant, sumCols As Variant
    Dim dic As Object, k As Variant, a As Variant
    On Error GoTo ErrH
    Inicio
    Set ws = Hoja("INFORMES")
    tipo = Txt(V("inf_Tipo")): d1 = CDate(V("inf_D1")): d2 = CDate(V("inf_D2"))
    cP = Txt(V("ic_P")): cC = Txt(V("ic_C")): cCl = Txt(V("ic_Cl")): cPr = Txt(V("ic_Pr")): cV = Txt(V("ic_V")): cG = Txt(V("ic_G"))
    Set filas = New Collection
    Select Case tipo
        Case "Ventas"
            enc = Array("Factura", "Fecha", "Cliente", "Vendedor", "Producto", "Nombre", "Cantidad", "Ventas netas", "IVA", "Costo", "Utilidad")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "@", "@", "#,##0.##", "$", "$", "$", "$")
            sumCols = Array(6, 7, 8, 9, 10)
            Set lo = T("tVentasDet")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Estado factura")) = "Activa" And EnRango(GetC(lo, i, "Fecha"), d1, d2) And Cumple(GetC(lo, i, "Producto"), cP) _
                   And Cumple(GetC(lo, i, "Categoría"), cC) And Cumple(GetC(lo, i, "Cliente"), cCl) And Cumple(GetC(lo, i, "Vendedor"), cV) Then
                    filas.Add Array(GetC(lo, i, "Factura"), GetC(lo, i, "Fecha"), GetC(lo, i, "Cliente"), GetC(lo, i, "Vendedor"), GetC(lo, i, "Producto"), _
                        GetC(lo, i, "Nombre producto"), GetC(lo, i, "Cantidad efectiva"), GetC(lo, i, "Base efectiva"), GetC(lo, i, "IVA efectivo"), _
                        GetC(lo, i, "Costo total"), GetC(lo, i, "Utilidad bruta"))
                End If
            Next i
        Case "Compras"
            enc = Array("Compra", "Recepción", "Proveedor", "Producto", "Nombre", "Cantidad", "Subtotal", "IVA", "Flete", "Costo total")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "@", "#,##0.##", "$", "$", "$", "$")
            sumCols = Array(5, 6, 7, 8, 9)
            Set lo = T("tComprasDet")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Estado recepción")) = "Recibida" And EnRango(GetC(lo, i, "Fecha recepción"), d1, d2) And Cumple(GetC(lo, i, "Producto"), cP) _
                   And Cumple(GetC(lo, i, "Categoría"), cC) And Cumple(GetC(lo, i, "Proveedor"), cPr) Then
                    filas.Add Array(GetC(lo, i, "Compra"), GetC(lo, i, "Fecha recepción"), GetC(lo, i, "Proveedor"), GetC(lo, i, "Producto"), GetC(lo, i, "Nombre producto"), _
                        GetC(lo, i, "Cantidad"), GetC(lo, i, "Subtotal"), GetC(lo, i, "IVA valor"), GetC(lo, i, "Flete prorrateado"), GetC(lo, i, "Costo total línea"))
                End If
            Next i
        Case "Gastos"
            enc = Array("Gasto", "Fecha", "Categoría", "Tipo", "Descripción", "Beneficiario", "Medio de pago", "Valor")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "@", "@", "@", "$")
            sumCols = Array(7)
            Set lo = T("tGastos")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Estado")) = "Pagado" And EnRango(GetC(lo, i, "Fecha"), d1, d2) And Cumple(GetC(lo, i, "Categoría"), cG) Then
                    filas.Add Array(GetC(lo, i, "Gasto"), GetC(lo, i, "Fecha"), GetC(lo, i, "Categoría"), GetC(lo, i, "Tipo gasto"), GetC(lo, i, "Descripción"), _
                        GetC(lo, i, "Beneficiario"), GetC(lo, i, "Medio de pago"), GetC(lo, i, "Valor"))
                End If
            Next i
        Case "Inventario"
            enc = Array("Código", "Nombre", "Categoría", "Stock", "Mínimo", "En tránsito", "Costo unitario", "Valor inventario", "Estado")
            fmt = Array("@", "@", "@", "#,##0.##", "#,##0", "#,##0.##", "$", "$", "@")
            sumCols = Array(7)
            For i = 1 To R("inv_Cod").Rows.Count
                If Txt(R("inv_Cod").Cells(i, 1).Value) <> "" Then
                    If Cumple(R("inv_Cod").Cells(i, 1).Value, cP) And Cumple(R("inv_Cat").Cells(i, 1).Value, cC) Then
                        filas.Add Array(R("inv_Cod").Cells(i, 1).Value, R("inv_Nombre").Cells(i, 1).Value, R("inv_Cat").Cells(i, 1).Value, _
                            R("inv_Stock").Cells(i, 1).Value, R("inv_Min").Cells(i, 1).Value, R("inv_Transito").Cells(i, 1).Value, _
                            R("inv_Costo").Cells(i, 1).Value, R("inv_Valor").Cells(i, 1).Value, R("inv_Estado").Cells(i, 1).Value)
                    End If
                End If
            Next i
        Case "Cartera"
            enc = Array("Factura", "Fecha", "Cliente", "Nombre", "Total", "Pagado", "Saldo", "Vence", "Días vencido", "Estado")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "$", "$", "$", "dd/mm/yyyy", "#,##0", "@")
            sumCols = Array(4, 5, 6)
            Set lo = T("tVentas")
            For i = 1 To lo.ListRows.Count
                If Num(GetC(lo, i, "Saldo")) > 1 And Cumple(GetC(lo, i, "Cliente"), cCl) Then
                    filas.Add Array(GetC(lo, i, "Factura"), GetC(lo, i, "Fecha"), GetC(lo, i, "Cliente"), GetC(lo, i, "Nombre cliente"), GetC(lo, i, "Total factura"), _
                        GetC(lo, i, "Pagado"), GetC(lo, i, "Saldo"), GetC(lo, i, "Vence"), GetC(lo, i, "Días vencido"), GetC(lo, i, "Estado pago"))
                End If
            Next i
        Case "Rentabilidad por producto"
            enc = Array("Código", "Nombre", "Categoría", "Unidades", "Ventas netas", "Costo", "Utilidad", "Margen")
            fmt = Array("@", "@", "@", "#,##0.##", "$", "$", "$", "0.0%")
            sumCols = Array(3, 4, 5, 6)
            Set dic = CreateObject("Scripting.Dictionary")
            Set lo = T("tVentasDet")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Estado factura")) = "Activa" And EnRango(GetC(lo, i, "Fecha"), d1, d2) And Cumple(GetC(lo, i, "Producto"), cP) _
                   And Cumple(GetC(lo, i, "Categoría"), cC) And Cumple(GetC(lo, i, "Cliente"), cCl) And Cumple(GetC(lo, i, "Vendedor"), cV) Then
                    k = Txt(GetC(lo, i, "Producto"))
                    If Not dic.Exists(k) Then dic.Add k, Array(k, Txt(GetC(lo, i, "Nombre producto")), Txt(GetC(lo, i, "Categoría")), 0#, 0#, 0#, 0#, 0#)
                    a = dic(k)
                    a(3) = a(3) + Num(GetC(lo, i, "Cantidad efectiva")): a(4) = a(4) + Num(GetC(lo, i, "Base efectiva"))
                    a(5) = a(5) + Num(GetC(lo, i, "Costo total")): a(6) = a(4) - a(5)
                    If a(4) <> 0 Then a(7) = a(6) / a(4)
                    dic(k) = a
                End If
            Next i
            For Each k In dic.Keys
                filas.Add dic(k)
            Next k
        Case "Cobros y pagos"
            enc = Array("Recibo", "Fecha", "Tipo", "Documento", "Tercero", "Medio de pago", "Valor", "Flujo")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "@", "@", "$", "$")
            sumCols = Array(7)
            Set lo = T("tPagos")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Estado")) = "Activo" And EnRango(GetC(lo, i, "Fecha"), d1, d2) Then
                    filas.Add Array(GetC(lo, i, "Recibo"), GetC(lo, i, "Fecha"), GetC(lo, i, "Tipo"), GetC(lo, i, "Documento"), GetC(lo, i, "Tercero"), _
                        GetC(lo, i, "Medio de pago"), GetC(lo, i, "Valor"), GetC(lo, i, "Flujo"))
                End If
            Next i
        Case "Pérdidas"
            enc = Array("Ajuste", "Fecha", "Producto", "Nombre", "Tipo", "Cantidad", "Motivo", "Responsable", "Valor pérdida")
            fmt = Array("@", "dd/mm/yyyy", "@", "@", "@", "#,##0.##", "@", "@", "$")
            sumCols = Array(8)
            Set lo = T("tAjustes")
            For i = 1 To lo.ListRows.Count
                If Txt(GetC(lo, i, "Es pérdida")) = "SI" And EnRango(GetC(lo, i, "Fecha"), d1, d2) And Cumple(GetC(lo, i, "Producto"), cP) Then
                    filas.Add Array(GetC(lo, i, "Ajuste"), GetC(lo, i, "Fecha"), GetC(lo, i, "Producto"), GetC(lo, i, "Nombre producto"), GetC(lo, i, "Tipo"), _
                        GetC(lo, i, "Cantidad"), GetC(lo, i, "Motivo"), GetC(lo, i, "Responsable"), GetC(lo, i, "Valor pérdida"))
                End If
            Next i
        Case Else
            Fallo "Seleccione el tipo de informe."
    End Select
    Desproteger ws
    EscribirDetalle ws, R("inf_Detalle"), "INFORME DE " & UCase$(tipo) & " · " & Format$(d1, "dd/mm/yyyy") & " a " & Format$(d2, "dd/mm/yyyy"), enc, fmt, filas, sumCols
    ws.PageSetup.PrintArea = "$A$1:$L$" & (R("inf_Detalle").Row + filas.Count + 3)
    Proteger ws
    RegistrarLog "Generar informe", tipo, filas.Count & " fila(s) · " & Format$(d1, "dd/mm/yyyy") & "-" & Format$(d2, "dd/mm/yyyy")
    Fin
    ws.Activate
    R("inf_Detalle").Select
    Aviso "Informe generado: " & filas.Count & " fila(s)."
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "No se pudo generar el informe"
End Sub

Private Sub EscribirDetalle(ws As Worksheet, destino As Range, titulo As String, enc As Variant, fmt As Variant, filas As Collection, sumCols As Variant)
    Dim i As Long, j As Long, nc As Long, arr() As Variant, tot() As Double, f As Variant, c As Variant
    ws.Range(destino.Offset(-1, 0), destino.Offset(20000, 11)).ClearContents
    ws.Range(destino.Offset(-1, 0), destino.Offset(20000, 11)).Interior.Pattern = xlNone
    ws.Range(destino.Offset(-1, 0), destino.Offset(20000, 11)).Font.Bold = False
    nc = UBound(enc) + 1
    destino.Offset(-1, 0).Value = titulo
    destino.Offset(-1, 0).Font.Bold = True
    destino.Resize(1, nc).Value = enc
    With destino.Resize(1, nc)
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = RGB(91, 107, 127)
    End With
    ReDim tot(0 To nc - 1)
    If filas.Count > 0 Then
        ReDim arr(1 To filas.Count, 1 To nc)
        i = 0
        For Each f In filas
            i = i + 1
            For j = 0 To nc - 1
                arr(i, j + 1) = f(j)
            Next j
            For Each c In sumCols
                tot(c) = tot(c) + Num(f(c))
            Next c
        Next f
        destino.Offset(1, 0).Resize(filas.Count, nc).Value = arr
        For j = 0 To nc - 1
            If fmt(j) = "$" Then
                destino.Offset(1, j).Resize(filas.Count + 1, 1).NumberFormat = """$"" #,##0;[Red]-""$"" #,##0"
            Else
                destino.Offset(1, j).Resize(filas.Count + 1, 1).NumberFormat = fmt(j)
            End If
        Next j
    End If
    destino.Offset(filas.Count + 1, 0).Value = "TOTAL (" & filas.Count & " filas)"
    For Each c In sumCols
        destino.Offset(filas.Count + 1, c).Value = tot(c)
    Next c
    destino.Offset(filas.Count + 1, 0).Resize(1, nc).Font.Bold = True
    destino.Offset(filas.Count + 1, 0).Resize(1, nc).Interior.Color = RGB(220, 230, 242)
End Sub

Private Function Carpeta(ByVal nombreCfg As String, ByVal subcarpeta As String) As String
    Dim c As String
    c = Txt(V(nombreCfg))
    If c = "" Then
        If ThisWorkbook.Path = "" Then Fallo "Guarde primero el archivo en una carpeta de su equipo."
        c = ThisWorkbook.Path & Application.PathSeparator & subcarpeta
    End If
    If Dir(c, vbDirectory) = "" Then MkDir c
    Carpeta = c
End Function

' Exporta una hoja a PDF en la carpeta de informes.
Public Sub ExportarHojaPDF(ByVal nombreHoja As String, Optional ByVal prefijo As String = "")
    Dim ws As Worksheet, ruta As String
    On Error GoTo ErrH
    Application.Calculate
    Set ws = Hoja(nombreHoja)
    If prefijo = "" Then prefijo = nombreHoja
    ruta = Carpeta("cfg_CarpetaInformes", "Informes") & Application.PathSeparator & prefijo & "_" & Format$(Now, "yyyymmdd_hhnnss") & ".pdf"
    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=ruta, Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, IgnorePrintAreas:=False, OpenAfterPublish:=Not mSilencio
    RegistrarLog "Exportar PDF", nombreHoja, ruta
    Aviso "PDF generado:" & vbCrLf & ruta
    Exit Sub
ErrH:
    MostrarError "No se pudo exportar a PDF"
End Sub

Public Sub ExportarInformePDF()
    ExportarHojaPDF "INFORMES", "Informe_" & Replace(Txt(V("inf_Tipo")), " ", "_")
End Sub

Public Sub ExportarDashboardPDF()
    ExportarHojaPDF "DASHBOARD", "Dashboard"
End Sub

' Copia el informe (valores y formatos) a un libro .xlsx independiente.
Public Sub ExportarInformeExcel()
    Dim ws As Worksheet, nb As Workbook, ruta As String
    On Error GoTo ErrH
    Application.ScreenUpdating = False
    Application.Calculate
    Set ws = Hoja("INFORMES")
    ruta = Carpeta("cfg_CarpetaInformes", "Informes") & Application.PathSeparator & "Informe_" & Replace(Txt(V("inf_Tipo")), " ", "_") & "_" & Format$(Now, "yyyymmdd_hhnnss") & ".xlsx"
    Set nb = Workbooks.Add(xlWBATWorksheet)
    ws.UsedRange.Copy
    nb.Worksheets(1).Range("A1").PasteSpecial xlPasteColumnWidths
    nb.Worksheets(1).Range("A1").PasteSpecial xlPasteValuesAndNumberFormats
    nb.Worksheets(1).Range("A1").PasteSpecial xlPasteFormats
    Application.CutCopyMode = False
    nb.Worksheets(1).Name = "Informe"
    Application.DisplayAlerts = False
    nb.SaveAs Filename:=ruta, FileFormat:=51
    Application.DisplayAlerts = True
    nb.Close SaveChanges:=False
    Application.ScreenUpdating = True
    RegistrarLog "Exportar Excel", "INFORMES", ruta
    Aviso "Informe exportado a Excel:" & vbCrLf & ruta
    Exit Sub
ErrH:
    Application.DisplayAlerts = True
    If Not nb Is Nothing Then nb.Close SaveChanges:=False
    MostrarError "No se pudo exportar a Excel"
End Sub

'==============================================================================
' 6. COPIAS DE SEGURIDAD, VALIDACIÓN Y DETECCIÓN DE ERRORES
'==============================================================================

Public Sub CopiaSeguridad()
    Dim ruta As String, ext As String
    On Error GoTo ErrH
    ext = Mid$(ThisWorkbook.Name, InStrRev(ThisWorkbook.Name, "."))
    ruta = Carpeta("cfg_CarpetaRespaldo", "Respaldos") & Application.PathSeparator & "NP360_respaldo_" & Format$(Now, "yyyymmdd_hhnnss") & ext
    ThisWorkbook.SaveCopyAs ruta
    RegistrarLog "Copia de seguridad", "-", ruta
    Aviso "Copia de seguridad creada:" & vbCrLf & ruta
    Exit Sub
ErrH:
    MostrarError "No se pudo crear la copia de seguridad"
End Sub

' Revisa campos obligatorios, columnas calculadas sobrescritas y referencias
' inválidas. Escribe el detalle en VALIDACION.
Public Sub ValidarDatos()
    Dim reglas As Variant, regla As Variant, p As Variant, lo As ListObject, i As Long, j As Long
    Dim ws As Worksheet, destino As Range, n As Long, lc As ListColumn, vacio As Boolean, c As Range
    On Error GoTo ErrH
    Inicio False
    Application.CalculateFull
    reglas = Array("tProductos:Código,Nombre,Categoría,Unidad,Costo compra,Precio venta,IVA %,Estado", "tClientes:Código,Nombre", _
                   "tProveedores:Código,Razón social", "tVentas:Factura,Fecha,Cliente,Medio de pago,Condición,Estado", _
                   "tVentasDet:Factura,Producto,Cantidad", "tCompras:Compra,Fecha,Proveedor,Estado recepción", _
                   "tComprasDet:Compra,Producto,Cantidad", "tPagos:Recibo,Fecha,Tipo,Documento,Medio de pago,Valor,Estado", _
                   "tGastos:Gasto,Fecha,Categoría,Medio de pago,Valor,Estado", "tAjustes:Ajuste,Fecha,Producto,Tipo,Cantidad", _
                   "tMovCaja:Movimiento,Fecha,Tipo,Medio de pago,Valor,Estado")
    Set ws = Hoja("VALIDACION")
    Desproteger ws
    Set destino = R("val_Detalle")
    ws.Range(destino, destino.Offset(5000, 3)).ClearContents
    For Each regla In reglas
        p = Split(regla, ":")
        Set lo = T(CStr(p(0)))
        For i = 1 To lo.ListRows.Count
            vacio = (Application.WorksheetFunction.CountA(lo.ListRows(i).Range) = 0)
            If Not vacio And Not (lo.ListRows.Count = 1 And EsVacio(lo.DataBodyRange.Cells(1, 1).Value)) Then
                For Each lc In lo.ListColumns
                    If InStr(1, "," & p(1) & ",", "," & lc.Name & ",", vbTextCompare) > 0 Then
                        If EsVacio(lo.DataBodyRange.Cells(i, lc.Index).Value) Then
                            AgregarProblema destino, n, lo.Name, i, lc.Name, "Campo obligatorio vacío"
                        End If
                    End If
                Next lc
            End If
        Next i
        ' columnas calculadas sobrescritas a mano
        If lo.ListRows.Count > 0 Then
            For Each lc In lo.ListColumns
                If lc.DataBodyRange.Cells(1, 1).HasFormula Then
                    If IsNull(lc.DataBodyRange.HasFormula) Then
                        For Each c In lc.DataBodyRange.Cells
                            If Not c.HasFormula Then AgregarProblema destino, n, lo.Name, c.Row - lo.HeaderRowRange.Row, lc.Name, "Fórmula sobrescrita con un valor: copie la fórmula de la fila superior"
                        Next c
                    End If
                End If
            Next lc
        End If
    Next regla
    ' controles de fórmula de la hoja
    For i = 6 To R("val_Total").Row - 1
        If Left$(Txt(ws.Cells(i, 4).Value), 1) = ChrW(10006) Then
            AgregarProblema destino, n, "Control", i, Txt(ws.Cells(i, 2).Value), Num(ws.Cells(i, 3).Value) & " caso(s) - revisar en " & Txt(ws.Cells(i, 5).Value)
        End If
    Next i
    Proteger ws
    RegistrarLog "Validar datos", "-", n & " problema(s) encontrados"
    Fin
    ws.Activate
    If n = 0 Then
        Aviso "Validación completa: no se encontraron problemas."
    Else
        Aviso "Validación completa: " & n & " problema(s). Vea el detalle en la hoja VALIDACION.", vbExclamation
    End If
    Exit Sub
ErrH:
    Proteger ws
    MostrarError "Error durante la validación"
End Sub

Private Sub AgregarProblema(destino As Range, n As Long, ByVal tabla As String, ByVal fila As Long, ByVal campo As String, ByVal problema As String)
    destino.Offset(n, 0).Value = tabla
    destino.Offset(n, 1).Value = fila
    destino.Offset(n, 2).Value = campo
    destino.Offset(n, 3).Value = problema
    n = n + 1
End Sub

' Busca celdas con error (#¡REF!, #¡VALOR!, #N/D...) en todas las hojas y nombres rotos.
Public Sub DetectarErrores()
    Dim ws As Worksheet, rg As Range, c As Range, nm As Object, n As Long, destino As Range, wv As Worksheet
    On Error GoTo ErrH
    Inicio False
    Application.CalculateFull
    Set wv = Hoja("VALIDACION")
    Desproteger wv
    Set destino = R("val_Detalle")
    wv.Range(destino, destino.Offset(5000, 3)).ClearContents
    For Each ws In ThisWorkbook.Worksheets
        Set rg = Nothing
        On Error Resume Next
        Set rg = ws.UsedRange.SpecialCells(xlCellTypeFormulas, xlErrors)
        On Error GoTo ErrH
        If Not rg Is Nothing Then
            For Each c In rg.Cells
                AgregarProblema destino, n, ws.Name, c.Row, c.Address(False, False), "Error de fórmula: " & c.Text
                If n > 4900 Then Exit For
            Next c
        End If
    Next ws
    For Each nm In ThisWorkbook.Names
        If InStr(1, nm.RefersTo, "#REF!", vbTextCompare) > 0 Then AgregarProblema destino, n, "Nombre definido", 0, nm.Name, "Referencia rota (#REF!)"
    Next nm
    Proteger wv
    RegistrarLog "Detectar errores", "-", n & " error(es)"
    Fin
    wv.Activate
    If n = 0 Then
        Aviso "No se encontraron errores de fórmula en el libro."
    Else
        Aviso n & " error(es) encontrados. Ver hoja VALIDACION.", vbExclamation
    End If
    Exit Sub
ErrH:
    Proteger wv
    MostrarError "Error al detectar errores"
End Sub

'==============================================================================
' 7. NAVEGACIÓN, BOTONES, PROTECCIÓN Y MANTENIMIENTO
'==============================================================================

Public Sub IrA(ByVal nombreHoja As String)
    On Error Resume Next
    ThisWorkbook.Worksheets(nombreHoja).Activate
    ThisWorkbook.Worksheets(nombreHoja).Range("A1").Select
End Sub

Public Sub IrInicio(): IrA "INICIO": End Sub
Public Sub IrDashboard(): IrA "DASHBOARD": End Sub
Public Sub IrVentas(): IrA "VENTAS": End Sub
Public Sub IrCompras(): IrA "COMPRAS": End Sub
Public Sub IrInventario(): IrA "INVENTARIO": End Sub
Public Sub IrCaja(): IrA "CAJA": End Sub
Public Sub IrCartera(): IrA "CARTERA": End Sub
Public Sub IrInformes(): IrA "INFORMES": End Sub
Public Sub IrReposicion(): IrA "REPOSICION": End Sub
Public Sub IrFormVenta(): IrA "F_VENTA": End Sub
Public Sub IrFormCompra(): IrA "F_COMPRA": End Sub
Public Sub IrMovimientos(): IrA "F_MOVIMIENTOS": End Sub

' Se ejecuta automáticamente al abrir el libro con macros habilitadas.
Public Sub Auto_Open()
    On Error Resume Next
    Application.Calculation = xlCalculationAutomatic
    ProtegerTodo
    If Not ExisteBoton(Hoja("F_VENTA"), "btn_RegistrarVenta") Then CrearBotones
    IrA "INICIO"
End Sub

Private Function ExisteBoton(ws As Worksheet, ByVal nombre As String) As Boolean
    Dim s As Shape
    For Each s In ws.Shapes
        If s.Name = nombre Then ExisteBoton = True: Exit Function
    Next s
End Function

Private Sub Boton(ByVal hojaNom As String, ByVal celda As String, ByVal ancho As Single, ByVal texto As String, ByVal macro As String, ByVal color As Long, Optional ByVal dx As Single = 0)
    Dim ws As Worksheet, s As Shape, c As Range
    Set ws = Hoja(hojaNom)
    On Error Resume Next
    ws.Shapes("btn_" & macro).Delete
    On Error GoTo 0
    Set c = ws.Range(celda)
    Set s = ws.Shapes.AddShape(5, c.Left + 2 + dx, c.Top + 1, ancho, 24)   ' 5 = msoShapeRoundedRectangle
    s.Name = "btn_" & macro
    s.Fill.ForeColor.RGB = color
    s.Line.Visible = False
    s.Placement = 3   ' xlFreeFloating
    With s.TextFrame
        .Characters.Text = texto
        .Characters.Font.Bold = True
        .Characters.Font.Size = 9
        .Characters.Font.Color = RGB(255, 255, 255)
        .HorizontalAlignment = xlHAlignCenter
        .VerticalAlignment = xlVAlignCenter
    End With
    s.OnAction = macro
End Sub

' Crea (o recrea) todos los botones de acción con su macro asignada.
Public Sub CrearBotones()
    Dim h As Variant, azul As Long, verde As Long, gris As Long, rojo As Long
    On Error GoTo ErrH
    azul = RGB(19, 49, 92): verde = RGB(30, 132, 73): gris = RGB(91, 107, 127): rojo = RGB(192, 57, 43)
    For Each h In Split(HOJAS_PROTEGIDAS, ",")
        Desproteger Hoja(CStr(h))
    Next h
    Boton "F_VENTA", "B16", 125, "REGISTRAR VENTA", "RegistrarVenta", verde
    Boton "F_VENTA", "C16", 115, "LIMPIAR FORMULARIO", "LimpiarVenta", gris
    Boton "F_VENTA", "E16", 110, "VER VENTAS", "IrVentas", azul
    Boton "F_COMPRA", "B16", 125, "REGISTRAR COMPRA", "RegistrarCompra", verde
    Boton "F_COMPRA", "C16", 115, "LIMPIAR FORMULARIO", "LimpiarCompra", gris
    Boton "F_COMPRA", "E16", 110, "VER COMPRAS", "IrCompras", azul
    Boton "F_COMPRA", "H12", 180, "CONFIRMAR RECEPCIÓN", "RecibirCompra", verde
    Boton "F_MOVIMIENTOS", "B14", 150, "REGISTRAR GASTO", "RegistrarGasto", verde
    Boton "F_MOVIMIENTOS", "C14", 100, "LIMPIAR", "LimpiarGasto", gris
    Boton "F_MOVIMIENTOS", "F14", 150, "REGISTRAR PAGO / ABONO", "RegistrarPago", verde
    Boton "F_MOVIMIENTOS", "G14", 100, "LIMPIAR", "LimpiarPago", gris
    Boton "F_MOVIMIENTOS", "B26", 150, "REGISTRAR AJUSTE", "RegistrarAjuste", verde
    Boton "F_MOVIMIENTOS", "C26", 100, "LIMPIAR", "LimpiarAjuste", gris
    Boton "F_MOVIMIENTOS", "F26", 150, "REGISTRAR MOVIMIENTO", "RegistrarMovCaja", verde
    Boton "F_MOVIMIENTOS", "G26", 100, "LIMPIAR", "LimpiarMovCaja", gris
    Boton "F_MOVIMIENTOS", "B34", 150, "REGISTRAR CIERRE", "RegistrarCierre", verde
    Boton "F_MOVIMIENTOS", "F34", 150, "ANULAR DOCUMENTO", "AnularDocumento", rojo
    Boton "F_CONSULTA", "B24", 140, "BUSCAR PRODUCTO", "ConsultarProducto", azul
    Boton "F_CONSULTA", "F24", 140, "BUSCAR CLIENTE", "BuscarCliente", azul
    Boton "KARDEX", "G5", 140, "GENERAR KARDEX", "GenerarKardex", verde
    Boton "REPOSICION", "H4", 200, "GENERAR ÓRDENES DE COMPRA", "GenerarPedidos", verde
    Boton "INFORMES", "E10", 150, "GENERAR INFORME", "GenerarInforme", verde
    Boton "INFORMES", "E12", 150, "EXPORTAR PDF", "ExportarInformePDF", azul
    Boton "INFORMES", "E14", 150, "EXPORTAR EXCEL", "ExportarInformeExcel", azul
    Boton "DASHBOARD", "L3", 140, "ACTUALIZAR DASHBOARD", "ActualizarDashboard", verde
    Boton "DASHBOARD", "O3", 110, "EXPORTAR PDF", "ExportarDashboardPDF", azul
    Boton "VALIDACION", "E3", 130, "VALIDAR DATOS", "ValidarDatos", verde
    Boton "VALIDACION", "E3", 130, "DETECTAR ERRORES", "DetectarErrores", azul, 140
    Boton "PRUEBAS", "G3", 190, "EJECUTAR AUTOPRUEBA DE MACROS", "AutoPruebaMacros", verde
    Boton "INICIO", "B47", 170, "COPIA DE SEGURIDAD", "CopiaSeguridad", verde
    Boton "INICIO", "E47", 150, "VALIDAR DATOS", "ValidarDatos", azul
    Boton "INICIO", "H47", 150, "DETECTAR ERRORES", "DetectarErrores", azul
    Boton "INICIO", "K47", 150, "PROTEGER HOJAS", "ProtegerHojas", gris
    Boton "INICIO", "N47", 110, "DESPROTEGER", "DesprotegerHojas", gris
    ProtegerTodo
    Exit Sub
ErrH:
    ProtegerTodo
    MsgBox "No se pudieron crear los botones: " & Err.Description, vbExclamation, APP
End Sub

' Amplía las filas de cálculo de INVENTARIO y ROTACION cuando hay más productos.
Public Sub AmpliarFilasCalculo()
    Dim extra As Variant, hojas As Variant, h As Variant, ws As Worksheet, ultima As Long, nueva As Long
    Dim nm As Object, i As Long
    On Error GoTo ErrH
    extra = InputBox("¿Cuántas filas adicionales de productos desea agregar?", APP, 200)
    If Not IsNumeric(extra) Or Val(extra) <= 0 Then Exit Sub
    Inicio False
    ultima = R("inv_Cod").Row + R("inv_Cod").Rows.Count - 1
    nueva = ultima + CLng(extra)
    hojas = Array("INVENTARIO", "ROTACION")
    For Each h In hojas
        Set ws = Hoja(CStr(h))
        Desproteger ws
        ws.Rows(ultima).Copy
        ws.Rows(ultima + 1 & ":" & nueva).PasteSpecial xlPasteAll
        Application.CutCopyMode = False
        For i = ultima + 1 To nueva
            ws.Cells(i, 1).Value = ws.Cells(i - 1, 1).Value + 1
        Next i
        ws.Range(ws.Cells(4, 1), ws.Cells(nueva, 40)).Replace What:="$" & ultima, Replacement:="$" & nueva, LookAt:=xlPart
        ws.Rows(4).Replace What:=ultima & ")", Replacement:=nueva & ")", LookAt:=xlPart
        ws.Rows(4).Replace What:=ultima & ",", Replacement:=nueva & ",", LookAt:=xlPart
        Proteger ws
    Next h
    For Each nm In ThisWorkbook.Names
        If Left$(nm.Name, 4) = "inv_" Or Left$(nm.Name, 4) = "rot_" Then
            If InStr(nm.RefersTo, "$" & ultima) > 0 Then nm.RefersTo = Replace(nm.RefersTo, "$" & ultima, "$" & nueva)
        End If
    Next nm
    Application.CalculateFull
    RegistrarLog "Ampliar filas de cálculo", "-", "Hasta la fila " & nueva
    Fin
    Aviso "Filas de cálculo ampliadas hasta la fila " & nueva & "."
    Exit Sub
ErrH:
    MostrarError "No se pudieron ampliar las filas"
End Sub

' Borra los datos de demostración (con respaldo previo). Conserva configuración,
' listas y fórmulas; deja cada tabla con una fila vacía lista para usar.
Public Sub BorrarDatosDemo()
    Dim tablas As Variant, t0 As Variant, lo As ListObject, c As Range
    On Error GoTo ErrH
    If MsgBox("Se borrarán TODOS los productos, clientes, proveedores, ventas, compras, pagos, gastos, ajustes, despachos y cierres." & vbCrLf & _
              "Se creará antes una copia de seguridad. ¿Continuar?", vbYesNo + vbExclamation, APP) = vbNo Then Exit Sub
    If InputBox("Escriba BORRAR para confirmar:", APP) <> "BORRAR" Then Exit Sub
    CopiaSeguridad
    Inicio False
    tablas = Array("tVentasDet", "tVentas", "tComprasDet", "tCompras", "tPagos", "tGastos", "tMovCaja", "tAjustes", "tDespachos", _
                   "tCierres", "tCostos", "tProductos", "tClientes", "tProveedores")
    For Each t0 In tablas
        Set lo = T(CStr(t0))
        Do While lo.ListRows.Count > 1
            lo.ListRows(lo.ListRows.Count).Delete
        Loop
        If lo.ListRows.Count = 1 Then
            For Each c In lo.ListRows(1).Range.Cells
                If Not c.HasFormula Then c.ClearContents
            Next c
        End If
    Next t0
    Application.CalculateFull
    RegistrarLog "Borrar datos demo", "-", "Sistema listo para datos reales"
    Fin
    MsgBox "Datos de demostración eliminados. Configure su negocio en CONFIG y empiece a registrar.", vbInformation, APP
    Exit Sub
ErrH:
    MostrarError "No se pudieron borrar los datos"
End Sub

'==============================================================================
' AUTOPRUEBA: ejecuta el flujo completo con las macros reales y anota el
' resultado en la hoja PRUEBAS. Los documentos de prueba quedan ANULADOS para
' que no afecten saldos ni inventario (trazabilidad completa en LOG).
'==============================================================================
Public Sub AutoPruebaMacros()
    Dim s0 As Double, s1 As Double, s2 As Double, s3 As Double, s4 As Double, fac As String, oc As String
    Dim res As String, ok As Boolean, wsP As Worksheet, fila As Long, f As Long, cobro As Double
    If MsgBox("La autoprueba registrará y luego ANULARÁ una venta y una compra del producto PT-001 (cliente CT-001)." & vbCrLf & _
              "Se recomienda hacer antes una copia de seguridad. ¿Continuar?", vbYesNo + vbQuestion, APP) = vbNo Then Exit Sub
    On Error GoTo ErrH
    ok = True
    mSilencio = True
    Application.Calculate
    s0 = StockDe("PT-001")
    ' 1) venta de contado de 1 unidad
    LimpiarVenta True
    R("fv_Cliente").Value = "CT-001": R("fv_Vendedor").Value = Txt(T("tVendedores").DataBodyRange.Cells(1, 1).Value)
    R("fv_Medio").Value = "Efectivo": R("fv_Condicion").Value = "Contado": R("fv_Obs").Value = "AUTOPRUEBA"
    R("fv_Lineas").Cells(1, 1).Value = "PT-001": R("fv_Lineas").Cells(1, 2).Value = 1
    If s0 < 1 Then R("fv_Autoriza").Value = "SI": R("fv_Clave").Value = Txt(V("cfg_ClaveAutoriza"))
    RegistrarVenta
    fac = mUltimoDoc
    Application.Calculate
    s1 = StockDe("PT-001")
    res = res & Linea("Venta registrada por macro (" & fac & ")", FilaDe(T("tVentas"), "Factura", fac) > 0, ok)
    res = res & Linea("Inventario disminuye 1 unidad (" & s0 & " -> " & s1 & ")", Abs(s0 - 1 - s1) < 0.001, ok)
    f = FilaDe(T("tVentas"), "Factura", fac)
    cobro = Num(GetC(T("tVentas"), f, "Pagado"))
    res = res & Linea("Cobro de contado creado una sola vez (pagado = total)", Abs(cobro - Num(GetC(T("tVentas"), f, "Total factura"))) < 1, ok)
    ' 2) anulación de la venta (y su cobro)
    R("fx_Tipo").Value = "Venta": R("fx_Documento").Value = fac: R("fx_Motivo").Value = "AUTOPRUEBA"
    AnularDocumento
    Application.Calculate
    s2 = StockDe("PT-001")
    res = res & Linea("Venta anulada: stock vuelve a " & s0, Abs(s2 - s0) < 0.001, ok)
    ' 3) compra pendiente, recepción y anulación
    LimpiarCompra True
    R("fc_Proveedor").Value = "PR01": R("fc_Obs").Value = "AUTOPRUEBA"
    R("fc_Lineas").Cells(1, 1).Value = "PT-001": R("fc_Lineas").Cells(1, 2).Value = 2
    RegistrarCompra
    oc = mUltimoDoc
    Application.Calculate
    s3 = StockDe("PT-001")
    res = res & Linea("Compra pendiente NO aumenta inventario (" & oc & ")", Abs(s3 - s0) < 0.001, ok)
    R("fr_Compra").Value = oc: R("fr_RecibidoPor").Value = "AUTOPRUEBA"
    RecibirCompra
    Application.Calculate
    s4 = StockDe("PT-001")
    res = res & Linea("Recepción aumenta inventario en 2 (" & s3 & " -> " & s4 & ")", Abs(s4 - s3 - 2) < 0.001, ok)
    R("fr_Compra").Value = oc
    On Error Resume Next
    RecibirCompra   ' segunda recepción: debe ser rechazada
    res = res & Linea("Segunda recepción rechazada (sin duplicar)", Err.Number <> 0, ok)
    Err.Clear
    On Error GoTo ErrH
    Limpiar "fr_Compra,fr_RecibidoPor"
    R("fx_Tipo").Value = "Compra": R("fx_Documento").Value = oc: R("fx_Motivo").Value = "AUTOPRUEBA"
    AnularDocumento
    Application.Calculate
    res = res & Linea("Compra anulada: stock vuelve a " & s0, Abs(StockDe("PT-001") - s0) < 0.001, ok)
    mSilencio = False
    ' anotar resultado en PRUEBAS
    Set wsP = Hoja("PRUEBAS")
    Desproteger wsP
    fila = wsP.Cells(wsP.Rows.Count, 9).End(xlUp).Row + 1
    If fila < 5 Then fila = 5
    wsP.Cells(4, 9).Value = "AUTOPRUEBAS DE MACROS (Excel)"
    wsP.Cells(4, 9).Font.Bold = True
    wsP.Cells(fila, 9).Value = Format$(Now, "dd/mm/yyyy hh:nn") & " · " & Usuario() & " · " & IIf(ok, "TODO OK", "CON ERRORES") & vbLf & res
    wsP.Cells(fila, 9).WrapText = True
    wsP.Columns(9).ColumnWidth = 70
    Proteger wsP
    RegistrarLog "Autoprueba de macros", fac & " / " & oc, IIf(ok, "OK", "CON ERRORES")
    MsgBox "Autoprueba terminada: " & IIf(ok, "TODO OK", "HAY ERRORES") & vbCrLf & vbCrLf & res, IIf(ok, vbInformation, vbExclamation), APP
    Exit Sub
ErrH:
    mSilencio = False
    Fin
    MsgBox "La autoprueba se detuvo por un error:" & vbCrLf & Err.Description & vbCrLf & vbCrLf & res, vbCritical, APP
End Sub

Private Function Linea(ByVal texto As String, ByVal bien As Boolean, ByRef ok As Boolean) As String
    If Not bien Then ok = False
    Linea = IIf(bien, "[OK] ", "[ERROR] ") & texto & vbLf
End Function
