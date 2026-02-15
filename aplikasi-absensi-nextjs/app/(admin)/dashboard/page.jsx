"use client";

import {
  Row,
  Col,
  Card,
  Statistic,
  DatePicker,
  Select,
  Button,
  Table,
  Space,
  message,
} from "antd";
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { dashboardApi } from "@/app/lib/api";

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DashboardPage = () => {
  const [stats, setStats] = useState({ totalPegawai: 0, hadir: 0, terlambat: 0 });
  const [lateRows, setLateRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rekapFilters, setRekapFilters] = useState({ bulan: dayjs().month() + 1, tahun: dayjs().year() });
  const [rekapData, setRekapData] = useState([]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const tanggal = dayjs().format("YYYY-MM-DD");
      const res = await dashboardApi.getAdminStats(tanggal);
      if (res.success) {
        setStats({
          totalPegawai: res.data.totalPegawai ?? 0,
          hadir: res.data.totalHadir ?? 0,
          terlambat: res.data.totalTerlambat ?? 0,
        });
        // Extract terlambat records from absensi data for late table
        setLateRows((res.data.rekapPerbulan || []).map((r, i) => ({ key: i, ...r })));
      } else {
        console.error("API Response Error:", res);
        message.error(res.message || "Gagal mengambil data dashboard");
      }
    } catch (err) {
      console.error("Dashboard Error:", err);
      message.error(err.message || "Terjadi kesalahan saat mengambil data dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchRekap = async () => {
    setLoading(true);
    try {
      console.log("[fetchRekap] Fetching with filters:", rekapFilters);
      const res = await dashboardApi.getAbsensiReport({ bulan: rekapFilters.bulan, tahun: rekapFilters.tahun });
      console.log("[fetchRekap] Response:", res);
      if (res.success) {
        console.log("[fetchRekap] Recap data:", res.recap);
        setRekapData((res.recap || []).map((r, i) => ({ key: i, ...r })));
      } else {
        console.error("[fetchRekap] API error:", res.message);
        message.error(res.message || "Gagal mengambil rekap");
      }
    } catch (err) {
      console.error("[fetchRekap] Error:", err);
      message.error("Terjadi kesalahan saat mengambil rekap: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const lateColumns = [
    { title: "No", dataIndex: "key", key: "key", render: (v, r, i) => i + 1 },
    { title: "Nama Pegawai", dataIndex: "nama_pegawai", key: "nama_pegawai" },
    { title: "Tanggal", dataIndex: "tanggal", key: "tanggal" },
    { title: "Jam Masuk", dataIndex: "jam_masuk", key: "jam_masuk", align: "center" },
    { title: "Menit Terlambat", dataIndex: "menit_terlambat", key: "menit_terlambat", align: "center" },
  ];

  const rekapColumns = [
    { title: "Pegawai", dataIndex: "nama", key: "nama" },
    { title: "Total Hadir", dataIndex: "totalHadir", key: "totalHadir", align: "center" },
    { title: "Total Terlambat", dataIndex: "totalTerlambat", key: "totalTerlambat", align: "center" },
    { title: "Total Izin", dataIndex: "totalIzin", key: "totalIzin", align: "center" },
    { title: "Total Tidak Hadir", dataIndex: "totalTidakHadir", key: "totalTidakHadir", align: "center", render: (value) => <span style={{ color: "#f5222d", fontWeight: "bold" }}>{value || 0}</span> },
    { title: "Total Jam Kerja", dataIndex: "totalJamKerja", key: "totalJamKerja", align: "right", render: (value, record) => {
        // Prefer computing from jamMasukDetails (per-day timestamps) when available
        // This ensures small durations like 00:00:13 are shown instead of 00:00:00
        let totalSeconds = 0;
        if (record && record.jamMasukDetails && Array.isArray(record.jamMasukDetails) && record.jamMasukDetails.length > 0) {
          record.jamMasukDetails.forEach((d) => {
            if (d.jam_masuk && d.jam_pulang) {
              try {
                const s = dayjs(d.jam_pulang).diff(dayjs(d.jam_masuk), "second");
                totalSeconds += Math.max(0, s);
              } catch {
                // ignore
              }
            }
          });
        }

        if (totalSeconds === 0) {
          // Fallback to aggregated decimal hours from backend
          const dec = parseFloat(value || 0);
          totalSeconds = Math.round(dec * 3600);
        }

        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const s = String(totalSeconds % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
      } },
    { title: "Total Jam Terlambat", dataIndex: "totalJamTerlambat", key: "totalJamTerlambat", align: "center", render: (value) => `${value || 0} menit` },
    { title: "Status", dataIndex: "status", key: "status", align: "center", render: (_, record) => {
        if ((record.totalIzin || 0) > 0) return 'Izin';
        if ((record.totalTerlambat || 0) > 0) return 'Terlambat';
        return 'Hadir';
      } },
  ];

  const handlePrintRekap = () => {
    const w = window.open("", "_blank");
    if (!w) return;

    const rows = (rekapData || []).map((item) => {
      // Use aggregated totalJamKerja from backend (includes leave hours)
      const dec = parseFloat(item.totalJamKerja || 0);
      const totalSeconds = Math.round(dec * 3600);
      
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      const totalHms = `${hh}:${mm}:${ss}`;
      const statusText = (item.totalIzin || 0) > 0 ? 'Izin' : (item.totalTerlambat || 0) > 0 ? 'Terlambat' : 'Hadir';

      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${item.nama || "-"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.totalHadir || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.totalTerlambat || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.totalIzin || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.totalTidakHadir || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${totalHms}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.totalJamTerlambat || 0} menit</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${statusText}</td>
        </tr>`;
    }).join("");

    const html = `
      <html>
        <head>
          <title>Rekap Absensi ${rekapFilters.bulan}/${rekapFilters.tahun}</title>
          <style>
            body{font-family: Arial, Helvetica, sans-serif; padding:16px}
            table{border-collapse:collapse;width:100%}
            th{background:#f5f5f5;padding:8px;border:1px solid #ddd;text-align:left;font-weight:bold}
            td{padding:8px;border:1px solid #ddd}
          </style>
        </head>
        <body>
          <h2>Rekap Absensi Bulan ${months[rekapFilters.bulan - 1]} ${rekapFilters.tahun}</h2>
          <table>
            <thead>
              <tr>
                <th>Nama Pegawai</th>
                <th>Total Hadir</th>
                <th>Total Terlambat</th>
                <th>Total Izin</th>
                <th>Total Tidak Hadir</th>
                <th>Total Jam Kerja</th>
                <th>Total Jam Terlambat</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>`;

    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ marginBottom: "24px" }}>Dashboard Admin</h1>

      <Row gutter={16} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Total Pegawai" value={stats.totalPegawai} prefix={<UserOutlined />} styles={{ content: { color: "#1890ff" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Hadir Hari Ini" value={stats.hadir} prefix={<CheckCircleOutlined />} styles={{ content: { color: "#52c41a" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Terlambat" value={stats.terlambat} prefix={<ClockCircleOutlined />} styles={{ content: { color: "#faad14" } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Select value={rekapFilters.bulan} onChange={(v)=> setRekapFilters({...rekapFilters, bulan: v})} options={months.map((m,i)=>({label:m,value:i+1}))} />
            <Select value={rekapFilters.tahun} onChange={(v)=> setRekapFilters({...rekapFilters, tahun: v})} options={[{label: dayjs().year(), value: dayjs().year()}, {label: dayjs().year()-1, value: dayjs().year()-1}]} />
            <Button type="primary" onClick={fetchRekap}>Tampilkan Rekap</Button>
          </div>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrintRekap}>Cetak Rekap</Button>
          </Space>
        </div>

        <Table columns={rekapColumns} dataSource={rekapData} pagination={{ pageSize: 10 }} size="small" />
      </Card>
    </div>
  );
};

export default DashboardPage;
