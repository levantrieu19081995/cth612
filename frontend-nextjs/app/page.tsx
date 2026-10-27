"use client";

import Link from "next/link";
import { useState } from "react";
import
{
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import
{
  IconActivityHeartbeat,
  IconArrowDown,
  IconArrowRight,
  IconDatabase,
  IconGitBranch,
  IconServer,
  IconTicket,
} from "@tabler/icons-react";

const nodes = [1, 2, 3, 4];

const systemPages = [
  {
    href: "/monitor",
    icon: IconActivityHeartbeat,
    title: "Giám sát hệ thống",
    description: "Xem trạng thái máy chủ, dịch vụ và database theo thời gian thực.",
    action: "Mở giám sát",
    color: "indigo",
  },
  {
    href: "/replication",
    icon: IconGitBranch,
    title: "Phân tán dữ liệu",
    description: "Khám phá vị trí các bản sao, range và khả năng chịu lỗi.",
    action: "Xem phân tán dữ liệu",
    color: "blue",
  },
  {
    href: "/analytics",
    icon: IconDatabase,
    title: "Thống kê hoạt động",
    description: "Theo dõi booking, sự kiện và số liệu vận hành.",
    action: "Mở thống kê",
    color: "teal",
  },
];

export default function HomePage()
{
  const [offlineNode, setOfflineNode] = useState<number | null>(null);
  const remainingCopies = offlineNode === null ? 3 : 2;

  return (
    <Box component="section" className="overview-page">
      <Stack gap={{ base: "xl", md: 48 }}>
        <Paper className="overview-hero" radius="xl" p={{ base: "lg", md: 40 }}>
          <Stack gap="xl">
            <Group align="flex-start" justify="space-between" gap="xl" wrap="wrap">
              <Box maw={680}>
                <Badge color="teal" variant="light" size="lg" mb="md">
                  CTH612 · HỆ THỐNG ĐẶT VÉ PHÂN TÁN
                </Badge>
                <Title order={1} className="overview-title">
                  Một hệ thống,
                  <br />
                  <span>nhiều node cùng vận hành.</span>
                </Title>
                <Text c="dimmed" size="lg" mt="md" maw={630}>
                  Tổng quan cách một yêu cầu đặt vé đi qua dịch vụ, được lưu an toàn
                  trên nhiều node và đồng bộ thành dòng sự kiện.
                </Text>
                <Group mt="xl" gap="sm">
                  <Button
                    component={Link}
                    href="/booking"
                    size="md"
                    radius="md"
                    leftSection={<IconTicket size={18} />}
                  >
                    Trải nghiệm đặt vé
                  </Button>
                  <Button
                    component={Link}
                    href="/monitor"
                    variant="light"
                    color="indigo"
                    size="md"
                    radius="md"
                    leftSection={<IconActivityHeartbeat size={18} />}
                  >
                    Mở giám sát
                  </Button>
                </Group>
              </Box>
              <Paper className="overview-principle" radius="lg" p="lg" withBorder>
                <ThemeIcon color="teal" variant="light" size={42} radius="md">
                  <IconGitBranch size={22} />
                </ThemeIcon>
                <Text fw={750} mt="md">Không phụ thuộc vào một máy</Text>
                <Text size="sm" c="dimmed" mt={5}>
                  Dữ liệu có bản sao; quorum quyết định phần nào tiếp tục phục vụ
                  khi node gặp sự cố.
                </Text>
              </Paper>
            </Group>

            <Paper className="overview-topology" radius="lg" p={{ base: "md", md: "lg" }} withBorder>
              <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                <Box>
                  <Text fw={750}>Sơ đồ cụm dữ liệu</Text>
                  <Text size="sm" c="dimmed">
                    Mô hình minh họa: 4 node, mỗi dữ liệu có 3 bản sao; không phải trạng thái máy thật.
                  </Text>
                </Box>
                <Badge
                  color={offlineNode === null ? "teal" : "orange"}
                  variant="light"
                  size="lg"
                  aria-live="polite"
                >
                  {offlineNode === null ? "Mô phỏng · đủ 4 node" : `Mô phỏng · Node ${offlineNode} ngắt`}
                </Badge>
              </Group>

              <div className="overview-flow">
                <div className="overview-flow-source">
                  <ThemeIcon color="blue" variant="light" size={38} radius="md">
                    <IconTicket size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">Ứng dụng đặt vé</Text>
                    <Text size="xs" c="dimmed">Yêu cầu booking</Text>
                  </div>
                  <IconArrowRight className="overview-flow-arrow" size={20} />
                  <ThemeIcon color="indigo" variant="light" size={38} radius="md">
                    <IconServer size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">Dịch vụ API</Text>
                    <Text size="xs" c="dimmed">Xử lý giao dịch</Text>
                  </div>
                </div>
                <div className="overview-flow-connector" aria-hidden="true">
                  <IconArrowDown size={20} />
                </div>

                <div className="overview-node-grid" aria-label="Mô hình bốn node dữ liệu">
                  {nodes.map((node) =>
                  {
                    const isOffline = offlineNode === node;
                    return (
                      <button
                        className={`overview-node${isOffline ? " overview-node-offline" : ""}`}
                        type="button"
                        key={node}
                        aria-pressed={isOffline}
                        aria-label={`Mô phỏng ${isOffline ? "khôi phục" : "ngắt kết nối"} Node ${node}`}
                        onClick={() => setOfflineNode(isOffline ? null : node)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <ThemeIcon
                            color={isOffline ? "red" : "teal"}
                            variant="light"
                            size={34}
                            radius="md"
                          >
                            <IconDatabase size={18} />
                          </ThemeIcon>
                          <Badge color={isOffline ? "red" : "teal"} variant="light" size="xs">
                            {isOffline ? "MÔ PHỎNG · NGẮT" : "MÔ PHỎNG · UP"}
                          </Badge>
                        </Group>
                        <Text fw={750} mt="sm">Node {String(node).padStart(2, "0")}</Text>
                        <Text size="xs" c="var(--mantine-color-white)" mt={3}>
                          CockroachDB · Cassandra
                        </Text>
                        <Text size="xs" mt="xs" c="var(--mantine-color-white)"
                          style={{
                            textDecoration: isOffline ? "line-through" : undefined
                          }}>
                          {isOffline ? "Node được mô phỏng ngắt" : "Tham gia lưu trữ dữ liệu"}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Alert
                className="overview-simulation-result"
                color={offlineNode === null ? "blue" : "teal"}
                variant="light"
                title={offlineNode === null ? "Thử nghiệm chịu lỗi" : "Một node ngắt kết nối"}
                mt="md"
              >
                {offlineNode === null
                  ? "Chọn một node trong sơ đồ để mô phỏng ngắt kết nối. Đây chỉ là minh họa trên giao diện, không tắt máy hay thay đổi dữ liệu thật."
                  : `Giả sử Node ${offlineNode} giữ 1 trong 3 bản sao của dữ liệu đang xét: còn ${remainingCopies}/3 bản sao, vừa đủ quorum 2/3 trong mô hình này. Nếu database đích chưa thể nhận sự kiện, outbox giữ lại để gửi lại khi khả dụng.`}
              </Alert>
            </Paper>
          </Stack>
        </Paper>

        <section aria-labelledby="overview-flow-title">
          <Group align="flex-end" justify="space-between" mb="md" gap="md" wrap="wrap">
            <Box>
              <Text className="home-eyebrow">TỪ BOOKING ĐẾN SỰ KIỆN</Text>
              <Title order={2} id="overview-flow-title" size="h2">
                Mỗi thành phần có một vai trò
              </Title>
            </Box>
            <Text c="dimmed" size="sm" maw={400}>
              Giao dịch đặt vé và lịch sử sự kiện được lưu theo hai cách phù hợp với
              mục đích sử dụng.
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {[
              { number: "01", title: "Đặt vé", text: "API kiểm tra chuyến bay, ghế và thông tin hành khách." },
              { number: "02", title: "Giao dịch", text: "CockroachDB lưu booking nhất quán với các bản sao." },
              { number: "03", title: "Outbox", text: "Sự kiện chờ đồng bộ được giữ lại nếu đích đến tạm gián đoạn." },
              { number: "04", title: "Event store", text: "Cassandra lưu lịch sử sự kiện để tra cứu và phân tích." },
            ].map((step) => (
              <Paper key={step.number} withBorder radius="lg" p="lg" className="overview-step">
                <Text fw={800} size="sm" c="teal.7">{step.number}</Text>
                <Title order={3} size="h4" mt="sm">{step.title}</Title>
                <Text size="sm" c="dimmed" mt="xs">{step.text}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        </section>

        <section aria-labelledby="overview-explore-title">
          <Group align="flex-end" justify="space-between" mb="md" gap="md" wrap="wrap">
            <Box>
              <Text className="home-eyebrow">ĐI SÂU HƠN</Text>
              <Title order={2} id="overview-explore-title" size="h2">
                Khám phá từng phần của hệ thống
              </Title>
            </Box>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {systemPages.map(({ href, icon: Icon, title, description, action, color }) => (
              <Paper key={href} component={Link} href={href} withBorder radius="lg" p="lg" className="overview-explore-card">
                <Group justify="space-between" align="flex-start">
                  <ThemeIcon color={color} variant="light" size={42} radius="md">
                    <Icon size={22} />
                  </ThemeIcon>
                  <IconArrowRight size={18} />
                </Group>
                <Title order={3} size="h4" mt="lg">{title}</Title>
                <Text size="sm" c="dimmed" mt="xs">{description}</Text>
                <Text size="sm" fw={700} c={`${color}.7`} mt="md">{action}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        </section>
      </Stack>
    </Box>
  );
}
