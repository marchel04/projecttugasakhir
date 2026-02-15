"use client";

import {
  Card,
  Statistic,
  Row,
  Col,
  Spin,
  Table,
  Divider,
  DatePicker,
  Button,
  Space,
} from "antd";
import { 
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  PrinterOutlined,
  BarChartOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";

const AbsenPegawaiComponent = () => {
  const [riwayat, setRiwayat] = useState([]);
  const [rekapData, setRekapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [filterDate, setFilterDate] = useState(null);
  const [filterMonth, setFilterMonth] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [monthlyRekapData, setMonthlyRekapData] = useState(null);

  const fetchUserData = useCallback(async () => {
    try {
      const result = await fetch("/api/auth/me");
      const data = await result.json();
      if (data.success) {
        setUserData(data.data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchRiwayat = useCallback(async () => {
    try {
      if (userData?.id_pegawai) {
        // Fetch riwayat
        const result = await fetch(`/api/absensi/riwayat`);
        const data = await result.json();
        
        if (data.success) {
          const formatted = data.data.slice(0, 10).map((item, idx) => {
            if (item.type === "absensi") {
              let totalHms = "-";
              
              // Try to use backend calculated value first (more reliable)
              if (item.total_jam_kerja) {
                let numVal = 0;
                if (typeof item.total_jam_kerja === 'number') {
                  numVal = item.total_jam_kerja;
                } else if (typeof item.total_jam_kerja === 'string') {
                  numVal = parseFloat(item.total_jam_kerja);
                } else if (item.total_jam_kerja && typeof item.total_jam_kerja === 'object') {
                  numVal = parseFloat(item.total_jam_kerja.toString());
                }
                
                if (numVal >= 0 && !isNaN(numVal)) {
                  const totalSeconds = Math.round(numVal * 3600);
                  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
                  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
                  const sec = String(totalSeconds % 60).padStart(2, "0");
                  totalHms = `${h}:${m}:${sec}`;
                }
              } else if (item.jam_masuk && item.jam_pulang) {
                // Fallback: calculate from jam_masuk and jam_pulang
                try {
                  const masukTime = dayjs(item.jam_masuk);
                  const pulangTime = dayjs(item.jam_pulang);
                  const s = pulangTime.diff(masukTime, "second");
                  
                  if (s > 0) {
                    const h = String(Math.floor(s / 3600)).padStart(2, "0");
                    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
                    const sec = String(s % 60).padStart(2, "0");
                    totalHms = `${h}:${m}:${sec}`;
                  }
                } catch (e) {
                  console.error("[AbsenPegawaiComponent] Error calculating from jam_masuk/jam_pulang:", e);
                }
              }

              return {
                key: idx,
                id_absensi: item.id_absensi,
                nama_pegawai: userData?.nama_lengkap || "-",
                tanggal: dayjs(item.tanggal).format("DD-MM-YYYY"),
                jam_masuk: item.jam_masuk ? dayjs(item.jam_masuk).format("HH:mm") : "-",
                jam_pulang: item.jam_pulang ? dayjs(item.jam_pulang).format("HH:mm") : "-",
                status: item.status || "Belum Pulang",
                jam_terlambat: item.jam_terlambat || 0,
                total_jam_kerja: totalHms,
                type: "absensi",
              };
            } else if (item.type === "izin") {
              // Backend sudah hitung total_jam_kerja, tinggal format HH:MM:SS
              let totalHms = "-";
              if (item.total_jam_kerja) {
                let numVal = 0;
                if (typeof item.total_jam_kerja === 'number') {
                  numVal = item.total_jam_kerja;
                } else if (typeof item.total_jam_kerja === 'string') {
                  numVal = parseFloat(item.total_jam_kerja);
                } else if (item.total_jam_kerja && typeof item.total_jam_kerja === 'object') {
                  numVal = parseFloat(item.total_jam_kerja.toString());
                }
                
                if (numVal >= 0 && !isNaN(numVal)) {
                  const totalSeconds = Math.round(numVal * 3600);
                  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
                  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
                  const s = String(totalSeconds % 60).padStart(2, "0");
                  totalHms = `${h}:${m}:${s}`;
                }
              }

              // Map status_izin to friendly label (pending/disetujui/ditolak)
              const rawStatus = item.data?.status_izin || "pending";
              const statusLabel = rawStatus === "pending"
                ? "Izin - Menunggu"
                : rawStatus === "disetujui"
                ? "Izin - Disetujui"
                : rawStatus === "ditolak"
                ? "Izin - Ditolak"
                : `Izin - ${rawStatus}`;

              return {
                key: idx,
                id_absensi: item.id_absensi,
                nama_pegawai: userData?.nama_lengkap || "-",
                tanggal: dayjs(item.tanggal).format("DD-MM-YYYY"),
                jam_masuk: "-",
                jam_pulang: "-",
                status: statusLabel,
                jam_terlambat: 0,
                total_jam_kerja: totalHms,
                type: "izin",
              };
            }
          });
          setRiwayat(formatted);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [userData]);

  const fetchRekapData = useCallback(async () => {
    try {
      if (userData?.id_pegawai) {
        const response = await fetch(`/api/rekap/pegawai-keseluruhan`);
        const result = await response.json();

        if (result.success) {
          setRekapData(result.data);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [userData]);

  const fetchMonthlyRecap = useCallback(async (month) => {
    try {
      const bulanParam = month.format("YYYY-MM");
      const response = await fetch(`/api/rekap/pegawai?bulan=${bulanParam}`);
      const result = await response.json();

      if (result.success) {
        setMonthlyRekapData(result.data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (userData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRiwayat();
      fetchRekapData();
      fetchMonthlyRecap(selectedMonth);
    }
  }, [userData, selectedMonth, fetchRiwayat, fetchRekapData, fetchMonthlyRecap]);

  // Convert jam desimal to HH:MM:SS format (available to UI and print)
  const convertJamToHMS = (jamDesimal) => {
    if (!jamDesimal || jamDesimal === 0) return "00:00:00";
    const totalSeconds = Math.round(jamDesimal * 3600);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handlePrintRekap = () => {
    const filename = `rekap-absensi-${selectedMonth.format("YYYY-MM")}.html`;
    // compute totals from riwayat rows for the selected month so print matches riwayat
    const rowsForMonth = riwayat.filter((r) => {
      try {
        return dayjs(r.tanggal, "DD-MM-YYYY").isSame(selectedMonth, "month");
      } catch (e) {
        return false;
      }
    });

    const totalHadir = rowsForMonth.filter((r) => r.type === "absensi").length;
    const totalIzin = rowsForMonth.filter((r) => r.type === "izin").length;
    const totalTerlambat = rowsForMonth.filter((r) => Number(r.jam_terlambat) > 0).length;
    const totalMenitTerlambat = rowsForMonth.reduce((acc, r) => acc + (Number(r.jam_terlambat) || 0), 0);

    // sum total_jam_kerja which is stored as HH:MM:SS in riwayat rows
    const totalDetikKerja = rowsForMonth.reduce((acc, r) => {
      if (!r.total_jam_kerja || r.total_jam_kerja === "-") return acc;
      const parts = String(r.total_jam_kerja).split(":").map((n) => Number(n) || 0);
      const sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      return acc + sec;
    }, 0);

    const pad = (n) => String(n).padStart(2, "0");
    const totalJamKerjaHMS = `${pad(Math.floor(totalDetikKerja / 3600))}:${pad(Math.floor((totalDetikKerja % 3600) / 60))}:${pad(totalDetikKerja % 60)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekap Absensi Personal - ${selectedMonth.format("YYYY-MM")}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { text-align: center; margin-bottom: 10px; }
            .subtitle { text-align: center; margin-bottom: 20px; color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 12px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; text-align: left; }
            td:first-child { text-align: left; }
          </style>
        </head>
        <body>
          <h2>Rekap Absensi Bulan ${selectedMonth.format("MMMM YYYY")}</h2>
          <div class="subtitle">Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
          
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
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${userData?.nama_lengkap || '-'}</td>
                <td>${totalHadir}</td>
                <td>${totalTerlambat}</td>
                <td>${totalIzin}</td>
                <td>${Math.max(0, rowsForMonth.length - totalHadir - totalIzin)}</td>
                <td>${totalJamKerjaHMS}</td>
                <td>${totalMenitTerlambat} menit</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) return;

    w.document.title = filename;
    setTimeout(() => {
      w.print();
      URL.revokeObjectURL(url);
    }, 300);
  };



  const columns = [
    {
      title: "Nama Pegawai",
      dataIndex: "nama_pegawai",
      key: "nama_pegawai",
      width: 180,
    },
    {
      title: "Tanggal",
      dataIndex: "tanggal",
      key: "tanggal",
    },
    {
      title: "Jam Masuk",
      dataIndex: "jam_masuk",
      key: "jam_masuk",
      align: "center",
    },
    {
      title: "Jam Pulang",
      dataIndex: "jam_pulang",
      key: "jam_pulang",
      align: "center",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      render: (value, record) => (
        <span style={{ 
          color: record.type === "izin" ? "#1890ff" : 
                 value.includes("terlambat") ? "#faad14" : 
                 value.includes("hadir") ? "#52c41a" : "#000",
          fontWeight: record.type === "izin" ? "bold" : "normal"
        }}>
          {value}
        </span>
      ),
    },
    {
      title: "Jam Terlambat",
      dataIndex: "jam_terlambat",
      key: "jam_terlambat",
      align: "right",
      render: (value, record) => {
        if (record.type === "izin") return "-";
        return (
          <span style={{ color: value > 0 ? "#f5222d" : "#52c41a" }}>
            {value} menit
          </span>
        );
      },
    },
    {
      title: "Total Jam Kerja",
      dataIndex: "total_jam_kerja",
      key: "total_jam_kerja",
      align: "right",
      render: (value, record) => {
        if (record.type === "izin") {
          return <span style={{ color: "#1890ff" }}>{value}</span>;
        }
        return (
          <span style={{ color: "#1890ff" }}>{value}</span>
        );
      },
    },
  ];

  // Filter data berdasarkan bulan atau tanggal yang dipilih
  const filteredRiwayat = riwayat.filter((row) => {
    if (filterMonth) {
      // Filter by month: bulan-tahun dari tanggal harus match filterMonth
      const rowMonthYear = dayjs(row.tanggal, "DD-MM-YYYY").format("MM-YYYY");
      const selectedMonthYear = filterMonth.format("MM-YYYY");
      return rowMonthYear === selectedMonthYear;
    }
    if (filterDate) {
      // Filter by specific date
      return row.tanggal === filterDate.format("DD-MM-YYYY");
    }
    return true;
  });

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}><BarChartOutlined /> Data Absensi Anda</h1>

      {/* Monthly Recap + Daily Search Filter - Side by Side */}
      <Row gutter={24} style={{ marginBottom: "24px" }}>
        {/* Left: Monthly Recap */}
        <Col xs={24} lg={12}>
          <Card 
            title={<><BarChartOutlined /> Rekap Bulanan</>}
            extra={
              <Button 
                type="primary" 
                icon={<PrinterOutlined />} 
                onClick={handlePrintRekap}
                size="small"
              >
                Cetak Rekap
              </Button>
            }
          >
            <Row gutter={12} align="middle" style={{ marginBottom: "16px" }}>
              <Col span={24}>
                <DatePicker
                  picker="month"
                  value={selectedMonth}
                  onChange={(date) => setSelectedMonth(date)}
                  format="MMMM YYYY"
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>

            {/* Monthly summary: show fetched monthly recap for selected month */}
            {monthlyRekapData && (
              <div style={{ marginTop: 12 }}>
                <Row gutter={12}>
                  <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic title="Hadir" value={monthlyRekapData.hadir || 0} />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic title="Terlambat" value={monthlyRekapData.terlambat || 0} />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic title="Izin" value={monthlyRekapData.izin || 0} />
                  </Col>

                  <Col xs={24} sm={12} md={8} lg={8} style={{ marginTop: 12 }}>
                    <Statistic title="Tanpa Keterangan" value={monthlyRekapData.tanpa_keterangan || 0} />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} style={{ marginTop: 12 }}>
                    <Statistic
                      title="Total Jam Kerja"
                      value={convertJamToHMS(
                        // prefer total_jam_kerja (decimal hours), fallback to total_detik_kerja
                        (monthlyRekapData.total_jam_kerja !== undefined && monthlyRekapData.total_jam_kerja !== null)
                          ? monthlyRekapData.total_jam_kerja
                          : (monthlyRekapData.total_detik_kerja ? (monthlyRekapData.total_detik_kerja / 3600) : 0)
                      )}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={8} style={{ marginTop: 12 }}>
                    <Statistic title="Menit Terlambat" value={`${monthlyRekapData.total_menit_terlambat || 0} menit`} />
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Daily Search Filter */}
        <Col xs={24} lg={12}>
          <Card title={<><SearchOutlined /> Pencarian Harian / Bulanan</>}>
            <Row gutter={12} align="middle" style={{ marginBottom: "16px" }}>
              <Col flex="auto">
                <DatePicker
                  onChange={(date) => {
                    setFilterDate(date);
                    if (date) setFilterMonth(null);
                  }}
                  allowClear
                  placeholder="Pilih tanggal"
                  format="DD-MM-YYYY"
                  style={{ width: "100%" }}
                />
              </Col>
              <Col>
                <Button onClick={() => { setFilterDate(null); setFilterMonth(null); }}>Reset</Button>
              </Col>
            </Row>

            <Row gutter={12} align="middle" style={{ marginBottom: "16px" }}>
              <Col flex="auto">
                <DatePicker
                  picker="month"
                  onChange={(m) => {
                    setFilterMonth(m);
                    if (m) setFilterDate(null);
                  }}
                  value={filterMonth}
                  allowClear
                  placeholder="Pilih bulan"
                  format="MMMM YYYY"
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>

            {(filterDate || filterMonth) && (
              <Card style={{ backgroundColor: "#fafafa" }}>
                <Statistic
                  title="Hasil Pencarian"
                  value={filteredRiwayat.length}
                  suffix="data"
                />
              </Card>
            )}
          </Card>
        </Col>
      </Row>

      {/* Riwayat Table */}
      <Spin spinning={loading}>
        <Card>
          <Table
            columns={columns}
            dataSource={filteredRiwayat}
            pagination={{ pageSize: 5 }}
            size="small"
            scroll={{ x: 800 }}
            locale={{ emptyText: "Tidak ada data" }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default AbsenPegawaiComponent;
