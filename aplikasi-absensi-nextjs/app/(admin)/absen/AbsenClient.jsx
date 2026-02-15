"use client";

import { SearchOutlined, FileTextOutlined, PrinterOutlined } from "@ant-design/icons";
import { Button, Input, message, Space, Table, DatePicker, Card, Row, Col, Spin } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

const AbsenClient = () => {
  const [tableData, setTableData] = useState([]);
  const [filterDate, setFilterDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [nameFilter, setNameFilter] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);
  const [pegawai, setPegawai] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");

  const getColumnSearchProps = (dataIndexPath) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder={`Cari`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() => {
            confirm();
            setSearchText(selectedKeys[0]);
            setSearchedColumn(dataIndexPath.join("."));
          }}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => {
              confirm();
              setSearchText(selectedKeys[0]);
              setSearchedColumn(dataIndexPath.join("."));
            }}
            icon={<SearchOutlined />}
            size="small"
          >
            Cari
          </Button>
          <Button
            onClick={() => {
              clearFilters();
              setSearchText("");
            }}
            size="small"
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value, record) => {
      const fieldValue = dataIndexPath.reduce((obj, key) => obj?.[key], record);

      return fieldValue
        ? fieldValue.toString().toLowerCase().includes(value.toLowerCase())
        : false;
    },
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // 1. ambil user login
        const meRes = await fetch("/api/auth/me");
        const meJson = await meRes.json();

        if (!meJson.success || !isMounted) return;

        setRole(meJson.data.role);

        // 2. ambil data pegawai berdasarkan nip
        const pegawaiRes = await fetch(`/api/pegawai/${meJson.data.nip}`);
        const pegawaiJson = await pegawaiRes.json();

        console.log("PEGAWAI JSON:", pegawaiJson);

        if (pegawaiJson.success && isMounted) {
          setPegawai(pegawaiJson.data);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!role) return;
    if (role !== "admin" && !pegawai) return;

    const fetchDataAbsensi = async () => {
      setLoading(true);
      try {
        let res;

        if (role === "admin") {
          // Determine what data to fetch based on filters
          if (selectedMonth) {
            // Monthly recap per pegawai (aggregated)
            const bulan = selectedMonth.format("YYYY-MM");
            res = await fetch(`/api/rekap?bulan=${bulan}`);
          } else if (nameFilter && !filterDate) {
            // If searching by name without date filter, fetch entire current month to show all employee's records
            const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");
            const monthEnd = dayjs().endOf("month").format("YYYY-MM-DD");
            res = await fetch(
              `/api/absensi/gabungan?tanggal_awal=${monthStart}&tanggal_akhir=${monthEnd}`
            );
          } else if (filterDate) {
            // If date is selected, fetch that specific date (or range if needed)
            const dateStr = filterDate.format("YYYY-MM-DD");
            res = await fetch(
              `/api/absensi/gabungan?tanggal_awal=${dateStr}&tanggal_akhir=${dateStr}`
            );
          } else {
            // If no filters, fetch today's data
            res = await fetch("/api/absensi/gabungan");
          }
        } else {
          res = await fetch(`/api/absensi/pegawai/${pegawai?.id_pegawai}`);
        }

        const json = await res.json();
        setTableData(json.data || []);
        // Reset pagination when data changes
        setTablePage(1);
      } catch (err) {
        message.error("Error : " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAbsensi();
  }, [role, pegawai, filterDate, nameFilter]);

  // Re-run fetch when selectedMonth changes
  useEffect(() => {
    if (!role) return;
    if (role !== "admin") return;
    // trigger data fetch by changing dependencies used in main effect
    // simplest: call fetch directly here
    let isMounted = true;
    const fetchMonthly = async () => {
      if (!selectedMonth) return;
      setLoading(true);
      try {
        const bulan = selectedMonth.format("YYYY-MM");
        const res = await fetch(`/api/rekap?bulan=${bulan}`);
        const json = await res.json();
        if (isMounted) setTableData(json.data || []);
        if (isMounted) setTablePage(1);
      } catch (err) {
        message.error("Error : " + err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMonthly();

    return () => { isMounted = false; };
  }, [selectedMonth, role]);

  // Filter by name only (date is already filtered by API)
  const filteredByName = tableData.filter((row) => {
    if (!nameFilter || nameFilter.trim() === "") return true;
    const nameVal = row.pegawai?.nama_lengkap || row.nama_pegawai || row.nama_lengkap || "";
    return nameVal.toLowerCase().includes(nameFilter.trim().toLowerCase());
  });

  const columnsDaily = [
    {
      title: "Nama Pegawai",
      dataIndex: ["pegawai", "nama_lengkap"],
      ...getColumnSearchProps(["pegawai", "nama_lengkap"]),
    },
    {
      title: "Tanggal Absensi",
      dataIndex: "tgl_absensi",
      key: "tgl_absensi",
      render: (val, record) => {
        const dateVal = val || record.tanggal;
        return dateVal ? dayjs(dateVal).format("YYYY-MM-DD") : "Belum absen";
      },
    },
    {
      title: "Jam Masuk",
      dataIndex: "jam_masuk",
      key: "jam_masuk",
      render: (val) =>
        val ? dayjs(val).format("HH:mm:ss") : "Belum absen masuk",
    },
    {
      title: "Jam Pulang",
      dataIndex: "jam_pulang",
      key: "jam_pulang",
      render: (val) =>
        val ? dayjs(val).format("HH:mm:ss") : "Belum absen pulang",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (val, record) => {
        if (record.type === "belum_absen") {
          return "Belum absen";
        }
        if (record.type === "izin") {
          return "Izin";
        }
        // prefer status_pulang if present
        const s = record.status_pulang || val || "-";
        return s;
      },
    },
    {
      title: "Menit Terlambat",
      dataIndex: "jam_terlambat",
      key: "jam_terlambat",
      align: "right",
      render: (val) => (val ? `${val} menit` : "0 menit"),
    },
    {
      title: "Total Jam Kerja",
      dataIndex: "total_jam_kerja",
      key: "total_jam_kerja",
      align: "right",
      render: (val, record) => {
        // Jika backend return 0 atau null, coba hitung dari jam_masuk/jam_pulang
        let numValue = 0;
        
        if (val !== null && val !== undefined) {
          if (typeof val === 'number') {
            numValue = val;
          } else if (typeof val === 'string') {
            numValue = parseFloat(val);
          } else if (val && typeof val === 'object' && val.toString) {
            numValue = parseFloat(val.toString());
          }
        }
        
        // Fallback: hitung dari jam_masuk dan jam_pulang jika value masih 0
        if ((numValue === 0 || isNaN(numValue)) && record.jam_masuk && record.jam_pulang) {
          try {
            const masukTime = dayjs(record.jam_masuk);
            const pulangTime = dayjs(record.jam_pulang);
            
            if (masukTime.isValid() && pulangTime.isValid()) {
              const durationSeconds = pulangTime.diff(masukTime, 'second');
              if (durationSeconds > 0) {
                numValue = parseFloat((durationSeconds / 3600).toFixed(4));
              }
            }
          } catch {
            // Silent fallback
          }
        }
        
        if (isNaN(numValue) || numValue < 0) {
          return "-";
        }
        
        // Convert decimal hours to HH:MM:SS format
        const totalSeconds = Math.round(numValue * 3600);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const sec = String(totalSeconds % 60).padStart(2, "0");
        return `${h}:${m}:${sec}`;
      },
    },
  ];

  const columnsMonthly = [
    {
      title: "Nama Pegawai",
      dataIndex: "nama_lengkap",
      key: "nama_lengkap",
      ...getColumnSearchProps(["nama_lengkap"]),
      render: (val, record) => val || record.nama_pegawai || record.pegawai?.nama_lengkap || "-",
    },
    { title: "Hadir", dataIndex: "hadir", key: "hadir" },
    { title: "Terlambat", dataIndex: "terlambat", key: "terlambat" },
    { title: "Izin", dataIndex: "izin", key: "izin" },
    { title: "Tanpa Keterangan", dataIndex: "tanpa_keterangan", key: "tanpa_keterangan" },
    {
      title: "Total Jam Kerja",
      dataIndex: "total_jam_kerja",
      key: "total_jam_kerja",
      render: (val, record) => {
        // backend may return decimal hours or total_detik_kerja
        let hours = 0;
        if (val !== null && val !== undefined) {
          if (typeof val === 'number') hours = val;
          else hours = parseFloat(String(val)) || 0;
        } else if (record.total_detik_kerja) {
          hours = Number(record.total_detik_kerja) / 3600;
        }
        const totalSeconds = Math.round(hours * 3600);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const s = String(totalSeconds % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
      }
    },
    { title: "Menit Terlambat", dataIndex: "total_menit_terlambat", key: "total_menit_terlambat", render: (v) => `${v || 0} menit` }
  ];

  const columns = selectedMonth ? columnsMonthly : columnsDaily;

  const handlePrintRekapAdmin = () => {
    // Use filteredByName (which already applies date filter)
    const rows = filteredByName;
    if (!rows || rows.length === 0) {
      message.info("Tidak ada data untuk dicetak");
      return;
    }

    // If nameFilter present, use that name; otherwise use 'Semua'
    const nameForTitle = nameFilter && nameFilter.trim() !== "" ? nameFilter.trim() : 'Semua Pegawai';

    const totalHadir = rows.filter((r) => r.type === 'absensi').length;
    const totalIzin = rows.filter((r) => r.type === 'izin').length;
    const totalTerlambatCount = rows.filter((r) => Number(r.jam_terlambat) > 0).length;
    const totalMenitTerlambat = rows.reduce((acc, r) => acc + (Number(r.jam_terlambat) || 0), 0);

    const totalDetikKerja = rows.reduce((acc, r) => {
      // r.total_jam_kerja may be decimal hours, or HH:MM:SS string
      const v = r.total_jam_kerja;
      if (v === null || v === undefined) return acc;
      if (typeof v === 'number') return acc + Math.round(v * 3600);
      const s = String(v);
      if (s.includes(':')) {
        const parts = s.split(':').map(p => Number(p) || 0);
        return acc + ((parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0));
      }
      const asNum = parseFloat(s);
      if (!Number.isNaN(asNum)) return acc + Math.round(asNum * 3600);
      return acc;
    }, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const totalJamKerjaHMS = `${pad(Math.floor(totalDetikKerja / 3600))}:${pad(Math.floor((totalDetikKerja % 3600) / 60))}:${pad(totalDetikKerja % 60)}`;

    const htmlRows = rows.map(r => {
      const tanggal = (r.tgl_absensi || r.tanggal) ? dayjs(r.tgl_absensi || r.tanggal).format('YYYY-MM-DD') : '-';
      const jamMasuk = r.jam_masuk ? dayjs(r.jam_masuk).format('HH:mm:ss') : '-';
      const jamPulang = r.jam_pulang ? dayjs(r.jam_pulang).format('HH:mm:ss') : '-';
      const status = r.type === 'izin' ? 'Izin' : (r.status_pulang || r.status || '-');
      const menitTerlambat = r.jam_terlambat ? `${r.jam_terlambat} menit` : '0 menit';
      const totalJam = (r.total_jam_kerja && typeof r.total_jam_kerja === 'string' && r.total_jam_kerja.includes(':')) ? r.total_jam_kerja : (() => {
        if (typeof r.total_jam_kerja === 'number') {
          const secs = Math.round(r.total_jam_kerja * 3600);
          return `${pad(Math.floor(secs/3600))}:${pad(Math.floor((secs%3600)/60))}:${pad(secs%60)}`;
        }
        return r.total_jam_kerja || '-';
      })();

      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${r.pegawai?.nama_lengkap || r.nama_pegawai || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd">${tanggal}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${jamMasuk}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${jamPulang}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${status}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${totalJam}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${menitTerlambat}</td>
        </tr>`;
    }).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Rekap Absensi - ${nameForTitle}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:16px}table{border-collapse:collapse;width:100%}th{background:#f5f5f5;padding:8px;border:1px solid #ddd;text-align:left}td{padding:8px;border:1px solid #ddd}</style>
        </head>
        <body>
          <h2>Rekap Absensi - ${nameForTitle}</h2>
          <div>Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
          <table style="margin-top:12px"><thead><tr><th>Nama Pegawai</th><th>Tanggal</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Status</th><th>Total Jam Kerja</th><th>Jam Terlambat</th></tr></thead><tbody>${htmlRows}</tbody></table>
          <h3 style="margin-top:16px">Ringkasan</h3>
          <table><tbody>
            <tr><td>Total Hadir</td><td>${totalHadir}</td></tr>
            <tr><td>Total Izin</td><td>${totalIzin}</td></tr>
            <tr><td>Total Terlambat (jumlah kasus)</td><td>${totalTerlambatCount}</td></tr>
            <tr><td>Total Menit Terlambat</td><td>${totalMenitTerlambat} menit</td></tr>
            <tr><td>Total Jam Kerja</td><td>${totalJamKerjaHMS}</td></tr>
          </tbody></table>
        </body>
      </html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 300);
  };

  return (
    <>
      <div style={{ paddingBottom: "20px" }}>
        <h1><FileTextOutlined /> Data Absensi</h1>
      </div>

      {/* Filter dan Export Rekap Bulanan */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <div>
              <label style={{ marginRight: "8px", fontWeight: "bold" }}>Pilih Tanggal Filter:</label>
              <DatePicker
                onChange={(date) => setFilterDate(date)}
                allowClear
                placeholder="Pilih tanggal"
                style={{ width: "100%" }}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Input.Search
              placeholder="Cari nama pegawai (mis. Kevin)"
              allowClear
              value={nameFilter}
              onSearch={(v) => { setNameFilter(v || ""); setTablePage(1); }}
              onChange={(e) => { setNameFilter(e.target.value); setTablePage(1); }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Space>
              <Button onClick={() => { setFilterDate(null); setNameFilter(""); setTablePage(1); }}>Reset Filter</Button>
              <Button type="primary" icon={<PrinterOutlined />} onClick={() => handlePrintRekapAdmin()}>
                Cetak Rekap
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Daily Data Table */}
      <Table
        columns={columns}
        rowKey={(row) => {
          // For monthly recap rows, use rekap-id_pegawai; otherwise use absensi/izin id with date
          if (selectedMonth) {
            return `rekap-${row.id_pegawai || row.id_pegawai || row.nama_lengkap}`;
          }
          // Ensure keys are unique and stable: include date for izin rows
          const datePart = dayjs(row.tgl_absensi || row.tanggal).format("YYYY-MM-DD");
          if (row.id_absensi) return `absensi-${row.id_absensi}`;
          if (row.id_izin) return `izin-${row.id_izin}-${datePart}`;
          const pegawaiId = row.pegawai?.id_pegawai || row.id_pegawai || "unknown";
          return `${row.type || 'row'}-${datePart}-${pegawaiId}`;
        }}
        dataSource={filteredByName}
        loading={loading}
        pagination={{ pageSize: 10, current: tablePage }}
        onChange={(pagination) => setTablePage(pagination.current || 1)}
        scroll={{ x: 1200 }}
      />
    </>
  );
};

export default AbsenClient;
