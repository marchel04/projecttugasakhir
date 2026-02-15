"use client";

import {
  Table,
  Card,
  Button,
  DatePicker,
  Select,
  Space,
  Row,
  Col,
  Spin,
  message,
  Divider,
  Tag,
  Tooltip,
} from "antd";
import { PrinterOutlined, DownloadOutlined, SearchOutlined, FileTextOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { dashboardApi, pegawaiApi } from "@/app/lib/api";
import dayjs from "dayjs";

const LaporanAbsensiComponent = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [recap, setRecap] = useState([]);
  const [pegawaiList, setPegawaiList] = useState([]);
  const [filters, setFilters] = useState({
    bulan: dayjs().month() + 1,
    tahun: dayjs().year(),
    pegawaiId: null,
  });

  const fetchPegawai = async () => {
    try {
      const result = await pegawaiApi.getAllPegawai();
      if (result.success) {
        setPegawaiList(
          result.data.map((p) => ({
            label: p.nama_lengkap,
            value: p.id_pegawai,
          }))
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.getAbsensiReport(filters);
      if (result.success) {
        // Format data - simpan raw data untuk calculation fallback
        const formattedData = result.data.map((item, idx) => ({
          key: idx,
          id_absensi: item.id_absensi,
          tanggal: dayjs(item.tgl_absensi).format("DD-MM-YYYY"),
          pegawai: item.pegawai?.nama_lengkap || "-",
          jam_masuk: item.jam_masuk
            ? dayjs(item.jam_masuk).format("HH:mm")
            : "-",
          jam_pulang: item.jam_pulang
            ? dayjs(item.jam_pulang).format("HH:mm")
            : "-",
          status: item.status || "-",
          jam_terlambat: item.jam_terlambat || 0,
          total_jam_kerja: item.total_jam_kerja,
          // Simpan raw data untuk fallback calculation di render
          _raw_jam_masuk: item.jam_masuk,
          _raw_jam_pulang: item.jam_pulang,
        }));
        setData(formattedData);
        setRecap(result.recap || []);
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil laporan absensi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPegawai();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const handlePrint = async () => {
    try {
      const result = await dashboardApi.printAbsensiReport(filters);
      if (result.success) {
        // Format HTML untuk print
        const htmlContent = generatePrintHTML(result.data, result.recap);
        const printWindow = window.open("", "_blank");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal generate laporan cetak");
    }
  };

  const generatePrintHTML = (data, recap) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Absensi</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h2>Laporan Absensi</h2>
          <p>Periode: ${filters.bulan}/${filters.tahun}</p>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Pegawai</th>
                <th>Jam Masuk</th>
                <th>Jam Pulang</th>
                <th>Status</th>
                <th>Jam Terlambat</th>
                <th>Total Jam Kerja</th>
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row) => `
                <tr>
                  <td>${row.tanggal}</td>
                  <td>${row.pegawai}</td>
                  <td>${row.jam_masuk}</td>
                  <td>${row.jam_pulang}</td>
                  <td>${row.status}</td>
                  <td>${row.jam_terlambat} menit</td>
                  <td>${row.total_jam_kerja} jam</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "tanggal",
      key: "tanggal",
      width: 100,
    },
    {
      title: "Pegawai",
      dataIndex: "pegawai",
      key: "pegawai",
      width: 150,
    },
    {
      title: "Jam Masuk",
      dataIndex: "jam_masuk",
      key: "jam_masuk",
      width: 100,
    },
    {
      title: "Jam Pulang",
      dataIndex: "jam_pulang",
      key: "jam_pulang",
      width: 100,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status) => {
        const colors = {
          hadir: "green",
          terlambat: "orange",
          pulang_cepat: "blue",
          alfa: "red",
        };
        return <Tag color={colors[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "Jam Terlambat",
      dataIndex: "jam_terlambat",
      key: "jam_terlambat",
      width: 120,
      render: (value) => `${value} menit`,
    },
    {
      title: "Total Jam Kerja",
      dataIndex: "total_jam_kerja",
      key: "total_jam_kerja",
      width: 130,
      align: "right",
      render: (val, record) => {
        // Konversi total_jam_kerja dari berbagai tipe data
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
        if ((numValue === 0 || isNaN(numValue)) && record._raw_jam_masuk && record._raw_jam_pulang) {
          try {
            const masukTime = dayjs(record._raw_jam_masuk);
            const pulangTime = dayjs(record._raw_jam_pulang);
            
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

  const rekapColumns = [
    {
      title: "Pegawai",
      dataIndex: "nama",
      key: "nama",
    },
    {
      title: "Total Hadir",
      dataIndex: "totalHadir",
      key: "totalHadir",
      align: "center",
    },
    {
      title: "Total Terlambat",
      dataIndex: "totalTerlambat",
      key: "totalTerlambat",
      align: "center",
    },
    {
      title: "Total Tidak Hadir",
      dataIndex: "totalTidakHadir",
      key: "totalTidakHadir",
      align: "center",
    },
    {
      title: "Total Jam Kerja",
      dataIndex: "totalJamKerja",
      key: "totalJamKerja",
      align: "right",
      render: (value) => `${parseFloat(value || 0).toFixed(2)} jam`,
    },
    {
      title: "Total Jam Terlambat",
      dataIndex: "totalJamTerlambat",
      key: "totalJamTerlambat",
      align: "right",
      render: (value) => `${value || 0} menit`,
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}><FileTextOutlined /> Laporan Absensi</h1>

      {/* Filter Card */}
      <Card style={{ marginBottom: "20px" }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={6}>
            <label>Bulan:</label>
            <Select
              value={filters.bulan}
              onChange={(value) =>
                setFilters({ ...filters, bulan: value })
              }
              style={{ width: "100%" }}
              options={[
                { label: "Januari", value: 1 },
                { label: "Februari", value: 2 },
                { label: "Maret", value: 3 },
                { label: "April", value: 4 },
                { label: "Mei", value: 5 },
                { label: "Juni", value: 6 },
                { label: "Juli", value: 7 },
                { label: "Agustus", value: 8 },
                { label: "September", value: 9 },
                { label: "Oktober", value: 10 },
                { label: "November", value: 11 },
                { label: "Desember", value: 12 },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <label>Tahun:</label>
            <Select
              value={filters.tahun}
              onChange={(value) =>
                setFilters({ ...filters, tahun: value })
              }
              style={{ width: "100%" }}
              options={[
                { label: dayjs().year().toString(), value: dayjs().year() },
                { label: (dayjs().year() - 1).toString(), value: dayjs().year() - 1 },
                { label: (dayjs().year() - 2).toString(), value: dayjs().year() - 2 },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <label>Pegawai (Opsional):</label>
            <Select
              placeholder="Semua Pegawai"
              allowClear
              value={filters.pegawaiId}
              onChange={(value) =>
                setFilters({ ...filters, pegawaiId: value })
              }
              style={{ width: "100%" }}
              options={pegawaiList}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Space>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handlePrint}
                loading={loading}
              >
                Print
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Data Table */}
      <Spin spinning={loading}>
        <Card title="Data Absensi" style={{ marginBottom: "20px" }}>
          <Table
            columns={columns}
            dataSource={data}
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* Recap Table */}
        {recap && recap.length > 0 && (
          <Card title="Rekap Per Pegawai">
            <Table
              columns={rekapColumns}
              dataSource={recap.map((item, idx) => ({ ...item, key: idx }))}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: 900 }}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default LaporanAbsensiComponent;
